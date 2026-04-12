import { Router } from 'express';
import { getDb } from '../db/database.js';
import { sendSuccess, sendError } from '../utils/helpers.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// All interest routes require authentication
router.use(requireAuth);

/**
 * GET /api/interests
 * List interest keywords for the authenticated user.
 */
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(
      'SELECT * FROM interests WHERE user_id = ? ORDER BY weight DESC, keyword ASC'
    ).all(req.user.id);
    sendSuccess(res, rows);
  } catch (err) {
    sendError(res, err.message);
  }
});

/**
 * POST /api/interests
 * Add an interest keyword for the authenticated user.
 */
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { keyword, weight = 1.0, category } = req.body;
    if (!keyword) return sendError(res, 'keyword is required', 400);

    const result = db.prepare(
      'INSERT INTO interests (keyword, weight, category, user_id) VALUES (?, ?, ?, ?)'
    ).run(keyword.toLowerCase().trim(), weight, category || null, req.user.id);

    const interest = db.prepare('SELECT * FROM interests WHERE id = ?').get(result.lastInsertRowid);
    sendSuccess(res, interest, 201);
  } catch (err) {
    if (err.message.includes('UNIQUE')) return sendError(res, 'Interest keyword already exists', 409);
    sendError(res, err.message);
  }
});

/**
 * POST /api/interests/bulk
 * Bulk import interest keywords for the authenticated user, skipping duplicates.
 */
router.post('/bulk', (req, res) => {
  try {
    const db = getDb();
    const { keywords } = req.body;
    if (!Array.isArray(keywords) || !keywords.length) return sendError(res, 'keywords array is required', 400);

    const insert = db.prepare('INSERT OR IGNORE INTO interests (keyword, weight, category, user_id) VALUES (?, ?, ?, ?)');
    const importMany = db.transaction((items) => {
      let added = 0, skipped = 0;
      for (const { keyword, weight = 1.0, category } of items) {
        const result = insert.run(keyword.toLowerCase().trim(), weight, category || null, req.user.id);
        result.changes > 0 ? added++ : skipped++;
      }
      return { added, skipped };
    });

    const result = importMany(keywords);
    sendSuccess(res, result);
  } catch (err) {
    sendError(res, err.message);
  }
});

/**
 * DELETE /api/interests/:id
 * Remove an interest keyword (only if it belongs to the authenticated user).
 */
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const result = db.prepare('DELETE FROM interests WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    if (result.changes === 0) return sendError(res, 'Interest not found', 404);
    sendSuccess(res, { deleted: true });
  } catch (err) {
    sendError(res, err.message);
  }
});

export default router;
