/**
 * Admin routes — all require auth + admin role.
 * GET    /api/admin/reported-comments     — list reported comments
 * POST   /api/admin/comments/:id/dismiss  — clear is_reported flag
 * DELETE /api/admin/comments/:id          — soft-delete comment
 * GET    /api/admin/stats                 — site-wide stats
 */
import { Router } from 'express';
import { getDb } from '../db/database.js';
import { sendSuccess, sendError } from '../utils/helpers.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/reported-comments', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT
        c.id, c.body, c.type, c.is_reported, c.created_at,
        u.username, u.id AS user_id,
        a.id AS article_id, a.title AS article_title,
        dt.id AS thread_id
      FROM comments c
      JOIN users u ON c.user_id = u.id
      JOIN debate_threads dt ON c.thread_id = dt.id
      JOIN articles a ON dt.article_id = a.id
      WHERE c.is_reported = 1 AND c.is_deleted = 0
      ORDER BY c.created_at DESC
    `).all();
    sendSuccess(res, rows);
  } catch (err) {
    sendError(res, err.message);
  }
});

router.post('/comments/:id/dismiss', (req, res) => {
  try {
    const db = getDb();
    const comment = db.prepare('SELECT id FROM comments WHERE id = ?').get(req.params.id);
    if (!comment) return sendError(res, 'Comment not found', 404);
    db.prepare('UPDATE comments SET is_reported = 0 WHERE id = ?').run(comment.id);
    sendSuccess(res, { dismissed: true });
  } catch (err) {
    sendError(res, err.message);
  }
});

router.delete('/comments/:id', (req, res) => {
  try {
    const db = getDb();
    const comment = db.prepare('SELECT id FROM comments WHERE id = ?').get(req.params.id);
    if (!comment) return sendError(res, 'Comment not found', 404);
    db.prepare('UPDATE comments SET is_deleted = 1, is_reported = 0 WHERE id = ?').run(comment.id);
    sendSuccess(res, { deleted: true });
  } catch (err) {
    sendError(res, err.message);
  }
});

router.get('/stats', (req, res) => {
  try {
    const db = getDb();
    const stats = {
      totalUsers:       db.prepare('SELECT COUNT(*) AS c FROM users').get().c,
      totalArticles:    db.prepare('SELECT COUNT(*) AS c FROM articles').get().c,
      totalComments:    db.prepare('SELECT COUNT(*) AS c FROM comments WHERE is_deleted = 0').get().c,
      reportedComments: db.prepare('SELECT COUNT(*) AS c FROM comments WHERE is_reported = 1 AND is_deleted = 0').get().c,
      openThreads:      db.prepare("SELECT COUNT(*) AS c FROM debate_threads WHERE status = 'open'").get().c,
      totalVotes:       db.prepare('SELECT COUNT(*) AS c FROM votes').get().c,
      bannedUsers:      db.prepare('SELECT COUNT(*) AS c FROM users WHERE is_banned = 1').get().c,
      totalOpinions:    db.prepare("SELECT COUNT(*) AS c FROM opinions WHERE status = 'published'").get().c,
    };
    sendSuccess(res, stats);
  } catch (err) {
    sendError(res, err.message);
  }
});

export default router;
