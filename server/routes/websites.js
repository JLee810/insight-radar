import { Router } from 'express';
import { getDb } from '../db/database.js';
import { sendSuccess, sendError, formatWebsite } from '../utils/helpers.js';
import { requireAuth } from '../middleware/auth.js';
import { triggerCheck } from '../services/scheduler.js';

const router = Router();

// All website routes require authentication
router.use(requireAuth);

/**
 * GET /api/websites
 * List websites tracked by the authenticated user.
 */
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(
      'SELECT * FROM websites WHERE user_id = ? ORDER BY created_at DESC'
    ).all(req.user.id);
    sendSuccess(res, rows.map(formatWebsite));
  } catch (err) {
    sendError(res, err.message);
  }
});

/**
 * POST /api/websites
 * Add a new website to track for the authenticated user.
 */
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { url, name, check_interval = 3600 } = req.body;
    if (!url || !name) return sendError(res, 'url and name are required', 400);

    const result = db.prepare(
      'INSERT INTO websites (url, name, check_interval, user_id) VALUES (?, ?, ?, ?)'
    ).run(url, name, check_interval, req.user.id);

    const website = db.prepare('SELECT * FROM websites WHERE id = ?').get(result.lastInsertRowid);
    sendSuccess(res, formatWebsite(website), 201);
  } catch (err) {
    if (err.message.includes('UNIQUE')) return sendError(res, 'Website URL already tracked', 409);
    sendError(res, err.message);
  }
});

/**
 * PATCH /api/websites/:id
 * Update website settings (only if it belongs to the authenticated user).
 */
router.patch('/:id', (req, res) => {
  try {
    const db = getDb();
    const website = db.prepare('SELECT * FROM websites WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!website) return sendError(res, 'Website not found', 404);

    const { name, check_interval, is_active } = req.body;
    const updates = [];
    const params = {};

    if (name !== undefined) { updates.push('name = @name'); params.name = name; }
    if (check_interval !== undefined) { updates.push('check_interval = @check_interval'); params.check_interval = check_interval; }
    if (is_active !== undefined) { updates.push('is_active = @is_active'); params.is_active = is_active ? 1 : 0; }

    if (!updates.length) return sendError(res, 'No valid fields to update', 400);

    params.id = req.params.id;
    db.prepare(`UPDATE websites SET ${updates.join(', ')} WHERE id = @id`).run(params);

    const updated = db.prepare('SELECT * FROM websites WHERE id = ?').get(req.params.id);
    sendSuccess(res, formatWebsite(updated));
  } catch (err) {
    sendError(res, err.message);
  }
});

/**
 * POST /api/websites/:id/check
 * Immediately trigger an article fetch for this website (runs in background).
 */
router.post('/:id/check', async (req, res) => {
  try {
    const db = getDb();
    const website = db.prepare('SELECT * FROM websites WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!website) return sendError(res, 'Website not found', 404);

    // Kick off asynchronously — don't wait for it to finish
    triggerCheck(website.id).catch(err => console.error(`Manual check failed for #${website.id}:`, err.message));
    sendSuccess(res, { triggered: true, websiteId: website.id, name: website.name });
  } catch (err) {
    sendError(res, err.message);
  }
});

/**
 * DELETE /api/websites/:id
 * Remove a website from tracking (only if it belongs to the authenticated user).
 */
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const result = db.prepare('DELETE FROM websites WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    if (result.changes === 0) return sendError(res, 'Website not found', 404);
    sendSuccess(res, { deleted: true });
  } catch (err) {
    sendError(res, err.message);
  }
});

export default router;
