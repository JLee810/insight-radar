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

/**
 * GET /api/admin/users
 * List all users with pagination.
 */
router.get('/users', (req, res) => {
  try {
    const db = getDb();
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;
    const search = req.query.search || '';
    const rows = db.prepare(`
      SELECT id, email, username, role, is_banned, created_at,
        (SELECT COUNT(*) FROM opinions WHERE user_id = users.id) AS opinion_count,
        (SELECT COUNT(*) FROM comments WHERE user_id = users.id AND is_deleted = 0) AS comment_count
      FROM users
      WHERE username LIKE ? OR email LIKE ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(`%${search}%`, `%${search}%`, limit, offset);
    const total = db.prepare("SELECT COUNT(*) AS c FROM users WHERE username LIKE ? OR email LIKE ?").get(`%${search}%`, `%${search}%`).c;
    sendSuccess(res, { users: rows, total });
  } catch (err) {
    sendError(res, err.message);
  }
});

/**
 * POST /api/admin/users/:id/ban
 * Ban or unban a user.
 */
router.post('/users/:id/ban', (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(req.params.id);
    if (!user) return sendError(res, 'User not found', 404);
    if (user.role === 'admin') return sendError(res, 'Cannot ban an admin', 403);
    const banned = req.body.banned ? 1 : 0;
    db.prepare('UPDATE users SET is_banned = ? WHERE id = ?').run(banned, user.id);
    // Revoke all refresh tokens if banning
    if (banned) db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(user.id);
    sendSuccess(res, { banned: !!banned });
  } catch (err) {
    sendError(res, err.message);
  }
});

/**
 * POST /api/admin/users/:id/promote
 * Toggle admin role.
 */
router.post('/users/:id/promote', (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(req.params.id);
    if (!user) return sendError(res, 'User not found', 404);
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(newRole, user.id);
    sendSuccess(res, { role: newRole });
  } catch (err) {
    sendError(res, err.message);
  }
});

/**
 * DELETE /api/admin/users/:id
 * Hard delete a user and all their content.
 */
router.delete('/users/:id', (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(req.params.id);
    if (!user) return sendError(res, 'User not found', 404);
    if (user.role === 'admin') return sendError(res, 'Cannot delete an admin account', 403);
    db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
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
