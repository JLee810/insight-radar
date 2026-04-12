/**
 * Notifications routes.
 * GET  /api/notifications           — list notifications for the auth'd user
 * POST /api/notifications/:id/read  — mark one as read
 * POST /api/notifications/read-all  — mark all as read
 */
import { Router } from 'express';
import { getDb } from '../db/database.js';
import { sendSuccess, sendError } from '../utils/helpers.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

/**
 * GET /api/notifications
 * Returns latest 50 notifications for the authenticated user.
 */
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT * FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).all(req.user.id);

    const unreadCount = db.prepare(
      'SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0'
    ).get(req.user.id).c;

    const formatted = rows.map(n => ({
      ...n,
      data: (() => { try { return JSON.parse(n.data); } catch { return {}; } })(),
    }));

    sendSuccess(res, { notifications: formatted, unreadCount });
  } catch (err) {
    sendError(res, err.message);
  }
});

/**
 * POST /api/notifications/read-all
 * Mark all notifications as read.
 */
router.post('/read-all', (req, res) => {
  try {
    const db = getDb();
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
    sendSuccess(res, { updated: true });
  } catch (err) {
    sendError(res, err.message);
  }
});

/**
 * POST /api/notifications/:id/read
 * Mark a single notification as read.
 */
router.post('/:id/read', (req, res) => {
  try {
    const db = getDb();
    const result = db.prepare(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?'
    ).run(req.params.id, req.user.id);
    if (result.changes === 0) return sendError(res, 'Notification not found', 404);
    sendSuccess(res, { updated: true });
  } catch (err) {
    sendError(res, err.message);
  }
});

export default router;
