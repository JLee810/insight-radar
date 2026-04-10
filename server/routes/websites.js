import { Router } from 'express';
import { getDb } from '../db/database.js';
import { sendSuccess, sendError, formatWebsite } from '../utils/helpers.js';

const router = Router();

/**
 * GET /api/websites
 * List all tracked websites.
 */
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM websites ORDER BY created_at DESC').all();
    sendSuccess(res, rows.map(formatWebsite));
  } catch (err) {
    sendError(res, err.message);
  }
});

/**
 * POST /api/websites
 * Add a new website to track.
 */
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { url, name, check_interval = 3600 } = req.body;
    if (!url || !name) return sendError(res, 'url and name are required', 400);

    const result = db.prepare(
      'INSERT INTO websites (url, name, check_interval) VALUES (?, ?, ?)'
    ).run(url, name, check_interval);

    const website = db.prepare('SELECT * FROM websites WHERE id = ?').get(result.lastInsertRowid);
    sendSuccess(res, formatWebsite(website), 201);
  } catch (err) {
    if (err.message.includes('UNIQUE')) return sendError(res, 'Website URL already tracked', 409);
    sendError(res, err.message);
  }
});

/**
 * PATCH /api/websites/:id
 * Update website settings.
 */
router.patch('/:id', (req, res) => {
  try {
    const db = getDb();
    const { name, check_interval, is_active } = req.body;
    const updates = [];
    const params = {};

    if (name !== undefined) { updates.push('name = @name'); params.name = name; }
    if (check_interval !== undefined) { updates.push('check_interval = @check_interval'); params.check_interval = check_interval; }
    if (is_active !== undefined) { updates.push('is_active = @is_active'); params.is_active = is_active ? 1 : 0; }

    if (!updates.length) return sendError(res, 'No valid fields to update', 400);

    params.id = req.params.id;
    db.prepare(`UPDATE websites SET ${updates.join(', ')} WHERE id = @id`).run(params);

    const website = db.prepare('SELECT * FROM websites WHERE id = ?').get(req.params.id);
    if (!website) return sendError(res, 'Website not found', 404);
    sendSuccess(res, formatWebsite(website));
  } catch (err) {
    sendError(res, err.message);
  }
});

/**
 * DELETE /api/websites/:id
 * Remove a website from tracking.
 */
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const result = db.prepare('DELETE FROM websites WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return sendError(res, 'Website not found', 404);
    sendSuccess(res, { deleted: true });
  } catch (err) {
    sendError(res, err.message);
  }
});

export default router;
