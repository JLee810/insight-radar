/**
 * Debate routes.
 * POST /api/debate/:articleId/vote       — cast vote (auth required)
 * GET  /api/debate/:articleId            — get thread + comments (public)
 * POST /api/debate/:articleId/comments   — add comment (auth required)
 * DELETE /api/debate/comments/:id        — delete comment (admin or own)
 * POST /api/debate/comments/:id/report   — report comment (auth required)
 */
import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { getDb } from '../db/database.js';
import { sendSuccess, sendError } from '../utils/helpers.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { commentLimit } from '../middleware/security.js';

const router = Router();

const VOTE_THRESHOLD = 5; // votes needed to open a thread

/**
 * POST /api/debate/:articleId/vote
 * Casts one vote per user per article. Opens thread at threshold.
 */
router.post('/:articleId/vote', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const articleId = Number(req.params.articleId);
    if (!articleId) return sendError(res, 'Invalid article ID', 400);

    const article = db.prepare('SELECT id FROM articles WHERE id = ?').get(articleId);
    if (!article) return sendError(res, 'Article not found', 404);

    // Upsert vote
    try {
      db.prepare('INSERT INTO votes (user_id, article_id) VALUES (?, ?)').run(req.user.id, articleId);
    } catch (e) {
      if (e.message.includes('UNIQUE')) return sendError(res, 'Already voted', 409);
      throw e;
    }

    // Upsert debate thread
    const thread = db.prepare('SELECT * FROM debate_threads WHERE article_id = ?').get(articleId);
    const voteCount = db.prepare('SELECT COUNT(*) as c FROM votes WHERE article_id = ?').get(articleId).c;

    if (!thread) {
      db.prepare('INSERT INTO debate_threads (article_id, vote_count) VALUES (?, ?)').run(articleId, voteCount);
    } else {
      const newStatus = voteCount >= VOTE_THRESHOLD && thread.status === 'voting' ? 'open' : thread.status;
      const openedAt = newStatus === 'open' && !thread.opened_at ? new Date().toISOString() : thread.opened_at;
      db.prepare('UPDATE debate_threads SET vote_count = ?, status = ?, opened_at = ? WHERE article_id = ?')
        .run(voteCount, newStatus, openedAt, articleId);
    }

    const updated = db.prepare('SELECT * FROM debate_threads WHERE article_id = ?').get(articleId);
    sendSuccess(res, { voteCount, thread: updated });
  } catch (err) {
    sendError(res, err.message);
  }
});

/**
 * GET /api/debate/:articleId
 * Returns thread info + nested comments (public; auth adds hasVoted flag).
 */
router.get('/:articleId', optionalAuth, (req, res) => {
  try {
    const db = getDb();
    const articleId = Number(req.params.articleId);

    const article = db.prepare(`
      SELECT a.*, w.name as website_name FROM articles a
      LEFT JOIN websites w ON a.website_id = w.id
      WHERE a.id = ?
    `).get(articleId);
    if (!article) return sendError(res, 'Article not found', 404);

    const thread = db.prepare('SELECT * FROM debate_threads WHERE article_id = ?').get(articleId);
    const voteCount = db.prepare('SELECT COUNT(*) as c FROM votes WHERE article_id = ?').get(articleId).c;

    const hasVoted = req.user
      ? !!db.prepare('SELECT id FROM votes WHERE user_id = ? AND article_id = ?').get(req.user.id, articleId)
      : false;

    // Fetch top-level comments with author info
    const comments = db.prepare(`
      SELECT c.*, u.username, u.role as user_role
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.thread_id = ? AND c.parent_id IS NULL AND c.is_deleted = 0
      ORDER BY c.created_at ASC
    `).all(thread?.id ?? -1);

    // Fetch replies
    const replies = thread ? db.prepare(`
      SELECT c.*, u.username, u.role as user_role
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.thread_id = ? AND c.parent_id IS NOT NULL AND c.is_deleted = 0
      ORDER BY c.created_at ASC
    `).all(thread.id) : [];

    // Nest replies under parents
    const replyMap = {};
    for (const r of replies) {
      if (!replyMap[r.parent_id]) replyMap[r.parent_id] = [];
      replyMap[r.parent_id].push(r);
    }
    const nested = comments.map(c => ({ ...c, replies: replyMap[c.id] || [] }));

    sendSuccess(res, {
      article: { ...article, ai_tags: tryParse(article.ai_tags, []) },
      thread: thread ? { ...thread, voteCount } : { voteCount, status: 'voting' },
      comments: nested,
      hasVoted,
    });
  } catch (err) {
    sendError(res, err.message);
  }
});

/**
 * POST /api/debate/:articleId/comments
 * Adds a comment to an open debate thread.
 */
router.post('/:articleId/comments', requireAuth, commentLimit, [
  body('body').trim().isLength({ min: 10, max: 2000 }),
  body('type').isIn(['argument', 'counter', 'evidence', 'question']),
  body('parent_id').optional({ nullable: true }).isInt(),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return sendError(res, errors.array()[0].msg, 400);

  try {
    const db = getDb();
    const articleId = Number(req.params.articleId);

    const thread = db.prepare('SELECT * FROM debate_threads WHERE article_id = ?').get(articleId);
    if (!thread || thread.status !== 'open') {
      return sendError(res, 'Debate thread is not open yet', 400);
    }

    const { body: text, type, parent_id = null } = req.body;

    // Validate parent belongs to same thread
    if (parent_id) {
      const parent = db.prepare('SELECT id FROM comments WHERE id = ? AND thread_id = ?').get(parent_id, thread.id);
      if (!parent) return sendError(res, 'Parent comment not found in this thread', 400);
    }

    const result = db.prepare(
      'INSERT INTO comments (thread_id, user_id, parent_id, type, body) VALUES (?, ?, ?, ?, ?)'
    ).run(thread.id, req.user.id, parent_id, type, text);

    const comment = db.prepare(`
      SELECT c.*, u.username, u.role as user_role
      FROM comments c JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `).get(result.lastInsertRowid);

    sendSuccess(res, { ...comment, replies: [] }, 201);
  } catch (err) {
    sendError(res, err.message);
  }
});

/**
 * DELETE /api/debate/comments/:id
 * Admin or comment owner can delete.
 */
router.delete('/comments/:id', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.id);
    if (!comment) return sendError(res, 'Comment not found', 404);

    if (req.user.role !== 'admin' && comment.user_id !== req.user.id) {
      return sendError(res, 'Not authorized', 403);
    }

    db.prepare('UPDATE comments SET is_deleted = 1 WHERE id = ?').run(comment.id);
    sendSuccess(res, { deleted: true });
  } catch (err) {
    sendError(res, err.message);
  }
});

/**
 * POST /api/debate/comments/:id/report
 * Flag a comment for admin review.
 */
router.post('/comments/:id/report', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const comment = db.prepare('SELECT id FROM comments WHERE id = ?').get(req.params.id);
    if (!comment) return sendError(res, 'Comment not found', 404);

    db.prepare('UPDATE comments SET is_reported = 1 WHERE id = ?').run(comment.id);
    sendSuccess(res, { reported: true });
  } catch (err) {
    sendError(res, err.message);
  }
});

function tryParse(val, fallback) {
  try { return JSON.parse(val); } catch { return fallback; }
}

export default router;
