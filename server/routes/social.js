/**
 * Social media routes.
 * Posts are filtered to: politics | socio-economic | health | education | technology.
 * Each post has an inline comments/discussion thread to encourage debate.
 *
 * GET    /api/social/sources              — list tracked accounts
 * POST   /api/social/sources              — add account to track
 * DELETE /api/social/sources/:id          — remove account + its posts
 * GET    /api/social/posts                — list filtered posts
 * POST   /api/social/refresh              — re-fetch all or one source
 * GET    /api/social/posts/:id/bias       — on-demand bias analysis
 * GET    /api/social/posts/:id/comments   — get discussion comments
 * POST   /api/social/posts/:id/comments   — post a comment (auth required)
 * DELETE /api/social/comments/:id         — delete own comment (auth required)
 */
import { Router } from 'express';
import { getDb } from '../db/database.js';
import { sendSuccess, sendError, safeJsonParse } from '../utils/helpers.js';
import { fetchSocialPosts, getPlatformStatus } from '../services/social-scraper.js';
import { checkSocialRelevance } from '../services/ai-analyzer.js';
import { analyzeBias } from '../services/bias-analyzer.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const TOPIC_COLORS = {
  politics:      { label: 'Politics',       color: 'red' },
  'socio-economic': { label: 'Socio-Economic', color: 'amber' },
  health:        { label: 'Health',         color: 'green' },
  education:     { label: 'Education',      color: 'blue' },
  technology:    { label: 'Technology',     color: 'purple' },
};

/** Convert a social_posts row into a clean API object. */
function formatPost(row) {
  return {
    ...row,
    bias: safeJsonParse(row.bias_data, null),
  };
}

/* ── Platform status ─────────────────────────────────────────────────── */

router.get('/platform-status', (req, res) => {
  sendSuccess(res, getPlatformStatus());
});

/* ── Sources ─────────────────────────────────────────────────────────── */

router.get('/sources', (req, res) => {
  try {
    const db = getDb();
    const sources = db.prepare(`
      SELECT s.*, COUNT(p.id) as post_count
      FROM social_sources s
      LEFT JOIN social_posts p ON p.source_id = s.id
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `).all();
    sendSuccess(res, sources);
  } catch (err) {
    sendError(res, err.message);
  }
});

router.post('/sources', async (req, res) => {
  try {
    const db = getDb();
    const { platform, handle, display_name } = req.body;
    if (!platform || !handle) return sendError(res, 'platform and handle are required', 400);

    const VALID = ['reddit', 'bluesky', 'x', 'instagram', 'facebook'];
    if (!VALID.includes(platform)) return sendError(res, `platform must be one of: ${VALID.join(', ')}`, 400);

    // Normalise handle
    let norm = handle.trim();
    if (platform === 'reddit' && !norm.match(/^[ru]\//i)) norm = `r/${norm}`;
    if (platform === 'bluesky') norm = norm.replace(/^@/, '');

    const exists = db.prepare('SELECT id FROM social_sources WHERE platform = ? AND handle = ?').get(platform, norm);
    if (exists) return sendError(res, 'This source is already tracked', 409);

    const result = db.prepare(
      'INSERT INTO social_sources (platform, handle, display_name) VALUES (?, ?, ?)'
    ).run(platform, norm, display_name?.trim() || norm);

    const source = db.prepare('SELECT * FROM social_sources WHERE id = ?').get(result.lastInsertRowid);

    // Non-blocking initial fetch + AI filtering
    _refreshSource(db, source)
      .catch(err => console.warn(`[social] initial fetch #${source.id}: ${err.message}`));

    sendSuccess(res, source, 201);
  } catch (err) {
    sendError(res, err.message);
  }
});

router.delete('/sources/:id', (req, res) => {
  try {
    const db = getDb();
    const id = Number(req.params.id);
    db.prepare('DELETE FROM social_comments WHERE post_id IN (SELECT id FROM social_posts WHERE source_id = ?)').run(id);
    db.prepare('DELETE FROM social_posts WHERE source_id = ?').run(id);
    const r = db.prepare('DELETE FROM social_sources WHERE id = ?').run(id);
    if (r.changes === 0) return sendError(res, 'Source not found', 404);
    sendSuccess(res, { deleted: true });
  } catch (err) {
    sendError(res, err.message);
  }
});

/* ── Posts ───────────────────────────────────────────────────────────── */

router.get('/posts', (req, res) => {
  try {
    const db = getDb();
    const { platform, source_id, category, limit = 20, offset = 0 } = req.query;
    const safeLimit  = Math.min(Math.max(1, parseInt(limit)  || 20), 100);
    const safeOffset = Math.max(0, parseInt(offset) || 0);

    const where  = ['p.is_relevant = 1'];
    const params = {};
    if (platform)  { where.push('p.platform = @platform');         params.platform  = platform; }
    if (source_id) { where.push('p.source_id = @source_id');       params.source_id = Number(source_id); }
    if (category)  { where.push('p.topic_category = @category');   params.category  = category; }

    const whereClause = `WHERE ${where.join(' AND ')}`;

    const rows = db.prepare(`
      SELECT p.*,
             s.display_name  AS source_display_name,
             s.handle        AS source_handle,
             (SELECT COUNT(*) FROM social_comments c WHERE c.post_id = p.id) AS comment_count
      FROM social_posts p
      LEFT JOIN social_sources s ON p.source_id = s.id
      ${whereClause}
      ORDER BY p.relevance_score DESC, p.posted_at DESC
      LIMIT ${safeLimit} OFFSET ${safeOffset}
    `).all(params);

    const { count } = db.prepare(
      `SELECT COUNT(*) AS count FROM social_posts p ${whereClause}`
    ).get(params);

    sendSuccess(res, { posts: rows.map(formatPost), total: count, limit: safeLimit, offset: safeOffset });
  } catch (err) {
    sendError(res, err.message);
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const db = getDb();
    const { source_id } = req.body || {};
    const sources = source_id
      ? [db.prepare('SELECT * FROM social_sources WHERE id = ?').get(Number(source_id))].filter(Boolean)
      : db.prepare('SELECT * FROM social_sources WHERE is_active = 1').all();

    if (!sources.length) return sendError(res, 'No sources found', 404);

    // Non-blocking
    Promise.all(sources.map(src => _refreshSource(db, src).catch(() => {})));

    sendSuccess(res, { refreshing: true, count: sources.length });
  } catch (err) {
    sendError(res, err.message);
  }
});

/* ── Bias ────────────────────────────────────────────────────────────── */

router.get('/posts/:id/bias', async (req, res) => {
  try {
    const db  = getDb();
    const row = db.prepare('SELECT * FROM social_posts WHERE id = ?').get(req.params.id);
    if (!row) return sendError(res, 'Post not found', 404);

    if (row.bias_data) {
      try { return sendSuccess(res, JSON.parse(row.bias_data)); } catch { /* re-analyze */ }
    }

    const bias = await analyzeBias({ title: row.content.slice(0, 120), content: row.content });
    db.prepare('UPDATE social_posts SET bias_data = ? WHERE id = ?').run(JSON.stringify(bias), row.id);
    sendSuccess(res, bias);
  } catch (err) {
    sendError(res, err.message);
  }
});

/* ── Comments / Discussion ───────────────────────────────────────────── */

router.get('/posts/:id/comments', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT c.*, u.username, u.role as user_role
      FROM social_comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.post_id = ?
      ORDER BY c.created_at ASC
    `).all(req.params.id);
    sendSuccess(res, rows);
  } catch (err) {
    sendError(res, err.message);
  }
});

router.post('/posts/:id/comments', requireAuth, (req, res) => {
  try {
    const db      = getDb();
    const postId  = Number(req.params.id);
    const userId  = req.user.id;
    const { content } = req.body;

    if (!content?.trim()) return sendError(res, 'Comment cannot be empty', 400);
    if (content.length > 1000) return sendError(res, 'Comment too long (max 1000 chars)', 400);

    const post = db.prepare('SELECT id FROM social_posts WHERE id = ?').get(postId);
    if (!post) return sendError(res, 'Post not found', 404);

    const result = db.prepare(
      'INSERT INTO social_comments (post_id, user_id, content) VALUES (?, ?, ?)'
    ).run(postId, userId, content.trim());

    const comment = db.prepare(`
      SELECT c.*, u.username, u.role as user_role
      FROM social_comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `).get(result.lastInsertRowid);

    sendSuccess(res, comment, 201);
  } catch (err) {
    sendError(res, err.message);
  }
});

router.delete('/comments/:id', requireAuth, (req, res) => {
  try {
    const db      = getDb();
    const comment = db.prepare('SELECT * FROM social_comments WHERE id = ?').get(req.params.id);
    if (!comment) return sendError(res, 'Comment not found', 404);

    const isAdmin = req.user.role === 'admin';
    const isOwner = comment.user_id === req.user.id;
    if (!isAdmin && !isOwner) return sendError(res, 'Forbidden', 403);

    db.prepare('DELETE FROM social_comments WHERE id = ?').run(req.params.id);
    sendSuccess(res, { deleted: true });
  } catch (err) {
    sendError(res, err.message);
  }
});

/* ── Internal helpers ────────────────────────────────────────────────── */

/**
 * Fetch posts for a source, run AI relevance filtering, save keepers to DB.
 */
async function _refreshSource(db, source) {
  const rawPosts = await fetchSocialPosts(source);

  const insert = db.prepare(`
    INSERT INTO social_posts
      (source_id, platform, external_id, author, handle, content, url,
       likes, shares, comments, media_url, posted_at, topic_category, relevance_score, is_relevant)
    VALUES
      (@source_id, @platform, @external_id, @author, @handle, @content, @url,
       @likes, @shares, @comments, @media_url, @posted_at, @topic_category, @relevance_score, @is_relevant)
  `);

  for (const post of rawPosts) {
    const exists = db.prepare('SELECT id FROM social_posts WHERE external_id = ?').get(post.external_id);
    if (exists) continue;

    // AI topic relevance check
    let topic_category  = 'other';
    let relevance_score = 0;
    let is_relevant     = 0;
    try {
      const check = await checkSocialRelevance({ content: `${post.title || ''} ${post.content || ''}` });
      topic_category  = check.category;
      relevance_score = check.relevance_score;
      is_relevant     = check.is_relevant && check.relevance_score >= 35 ? 1 : 0;
    } catch { /* keep defaults — do not block on AI errors */ }

    const { lastInsertRowid } = insert.run({
      source_id:      source.id,
      platform:       source.platform,
      external_id:    post.external_id,
      author:         (post.author  || '').slice(0, 100),
      handle:         (post.handle  || '').slice(0, 100),
      content:        (post.content || '').slice(0, 2000),
      url:            post.url       || '',
      likes:          post.likes     || 0,
      shares:         post.shares    || 0,
      comments:       post.comments  || 0,
      media_url:      post.media_url || null,
      posted_at:      post.posted_at || null,
      topic_category,
      relevance_score,
      is_relevant,
    });

    // Background bias analysis (non-blocking)
    if (is_relevant) {
      analyzeBias({ title: post.title || (post.content || '').slice(0, 120), content: post.content || '' })
        .then(b => db.prepare('UPDATE social_posts SET bias_data = ? WHERE id = ?').run(JSON.stringify(b), lastInsertRowid))
        .catch(() => {});
    }
  }

  db.prepare('UPDATE social_sources SET last_checked = CURRENT_TIMESTAMP WHERE id = ?').run(source.id);
}

export default router;
