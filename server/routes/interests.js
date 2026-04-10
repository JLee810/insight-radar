import { Router } from 'express';
import { getDb } from '../db/database.js';
import { sendSuccess, sendError } from '../utils/helpers.js';

const router = Router();

/**
 * GET /api/interests
 * List all interest keywords.
 */
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM interests ORDER BY weight DESC, keyword ASC').all();
    sendSuccess(res, rows);
  } catch (err) {
    sendError(res, err.message);
  }
});

/**
 * POST /api/interests
 * Add an interest keyword.
 */
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { keyword, weight = 1.0, category } = req.body;
    if (!keyword) return sendError(res, 'keyword is required', 400);

    const result = db.prepare(
      'INSERT INTO interests (keyword, weight, category) VALUES (?, ?, ?)'
    ).run(keyword.toLowerCase().trim(), weight, category || null);

    const interest = db.prepare('SELECT * FROM interests WHERE id = ?').get(result.lastInsertRowid);
    sendSuccess(res, interest, 201);
  } catch (err) {
    if (err.message.includes('UNIQUE')) return sendError(res, 'Interest keyword already exists', 409);
    sendError(res, err.message);
  }
});

/**
 * DELETE /api/interests/:id
 * Remove an interest keyword.
 */
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const result = db.prepare('DELETE FROM interests WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return sendError(res, 'Interest not found', 404);
    sendSuccess(res, { deleted: true });
  } catch (err) {
    sendError(res, err.message);
  }
});

export default router;
