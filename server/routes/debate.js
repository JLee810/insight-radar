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
import { sendSuccess, sendError, tryParse } from '../utils/helpers.js';
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

    // Upsert debate thread inside a transaction to prevent race conditions
    const upsertThread = db.transaction(() => {
      const voteCount = db.prepare('SELECT COUNT(*) as c FROM votes WHERE article_id = ?').get(articleId).c;
      const thread = db.prepare('SELECT * FROM debate_threads WHERE article_id = ?').get(articleId);
      if (!thread) {
        db.prepare('INSERT OR IGNORE INTO debate_threads (article_id, vote_count) VALUES (?, ?)').run(articleId, voteCount);
      } else {
        const newStatus = voteCount >= VOTE_THRESHOLD && thread.status === 'voting' ? 'open' : thread.status;
        const openedAt = newStatus === 'open' && !thread.opened_at ? new Date().toISOString() : thread.opened_at;
        db.prepare('UPDATE debate_threads SET vote_count = ?, status = ?, opened_at = ? WHERE article_id = ?')
          .run(voteCount, newStatus, openedAt, articleId);
      }
      return db.prepare('SELECT COUNT(*) as c FROM votes WHERE article_id = ?').get(articleId).c;
    });
    const voteCount = upsertThread();
    const updated = db.prepare('SELECT * FROM debate_threads WHERE article_id = ?').get(articleId);

    // Notify all voters when debate first opens
    if (updated.status === 'open' && updated.opened_at) {
      const voters = db.prepare(
        'SELECT DISTINCT user_id FROM votes WHERE article_id = ? AND user_id != ?'
      ).all(articleId, req.user.id);
      const notifyStmt = db.prepare(
        "INSERT OR IGNORE INTO notifications (user_id, type, data) VALUES (?, 'debate_open', ?)"
      );
      const notifData = JSON.stringify({ articleId, articleTitle: db.prepare('SELECT title FROM articles WHERE id = ?').get(articleId)?.title });
      for (const v of voters) notifyStmt.run(v.user_id, notifData);
    }

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

    // Fetch top-level comments with author info and like counts
    const comments = db.prepare(`
      SELECT c.*, u.username, u.role as user_role,
        (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id) AS like_count
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.thread_id = ? AND c.parent_id IS NULL AND c.is_deleted = 0
      ORDER BY c.created_at ASC
    `).all(thread?.id ?? -1);

    // Fetch replies with like counts
    const replies = thread ? db.prepare(`
      SELECT c.*, u.username, u.role as user_role,
        (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id) AS like_count
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.thread_id = ? AND c.parent_id IS NOT NULL AND c.is_deleted = 0
      ORDER BY c.created_at ASC
    `).all(thread.id) : [];

    // Which comments the current user has liked
    const likedIds = req.user && thread ? new Set(
      db.prepare(`
        SELECT comment_id FROM comment_likes cl
        JOIN comments c ON cl.comment_id = c.id
        WHERE cl.user_id = ? AND c.thread_id = ?
      `).all(req.user.id, thread.id).map(r => r.comment_id)
    ) : new Set();

    // Nest replies under parents, attach liked flag
    const replyMap = {};
    for (const r of replies) {
      if (!replyMap[r.parent_id]) replyMap[r.parent_id] = [];
      replyMap[r.parent_id].push({ ...r, hasLiked: likedIds.has(r.id) });
    }
    const nested = comments.map(c => ({
      ...c,
      hasLiked: likedIds.has(c.id),
      replies: replyMap[c.id] || [],
    }));

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

    // Notify parent comment author about reply (if not replying to self)
    if (parent_id) {
      const parent = db.prepare('SELECT user_id FROM comments WHERE id = ?').get(parent_id);
      if (parent && parent.user_id !== req.user.id) {
        db.prepare(
          "INSERT INTO notifications (user_id, type, data) VALUES (?, 'reply', ?)"
        ).run(parent.user_id, JSON.stringify({
          commentId: result.lastInsertRowid,
          articleId,
          replierUsername: req.user.username,
          excerpt: text.slice(0, 100),
        }));
      }
    }

    sendSuccess(res, { ...comment, replies: [], like_count: 0, hasLiked: false }, 201);
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

/**
 * POST /api/debate/comments/:id/like
 * Toggle like on a comment.
 */
router.post('/comments/:id/like', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const commentId = Number(req.params.id);
    const comment = db.prepare('SELECT id FROM comments WHERE id = ? AND is_deleted = 0').get(commentId);
    if (!comment) return sendError(res, 'Comment not found', 404);

    const existing = db.prepare('SELECT id FROM comment_likes WHERE user_id = ? AND comment_id = ?').get(req.user.id, commentId);
    if (existing) {
      db.prepare('DELETE FROM comment_likes WHERE user_id = ? AND comment_id = ?').run(req.user.id, commentId);
    } else {
      db.prepare('INSERT INTO comment_likes (user_id, comment_id) VALUES (?, ?)').run(req.user.id, commentId);
    }
    const likeCount = db.prepare('SELECT COUNT(*) as c FROM comment_likes WHERE comment_id = ?').get(commentId).c;
    sendSuccess(res, { liked: !existing, likeCount });
  } catch (err) {
    sendError(res, err.message);
  }
});

export default router;
