/**
 * Opinions routes — NewPublicSphere layer.
 * GET    /api/opinions       — list published opinions (public)
 * GET    /api/opinions/:id   — single opinion (public)
 * POST   /api/opinions       — create opinion (auth required)
 * PATCH  /api/opinions/:id   — update own opinion (auth required)
 * DELETE /api/opinions/:id   — delete own opinion (auth required)
 */
import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { getDb } from '../db/database.js';
import { sendSuccess, sendError } from '../utils/helpers.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', optionalAuth, (req, res) => {
  try {
    const db = getDb();
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;
    const { username } = req.query;
    const rows = db.prepare(`
      SELECT
        o.id, o.title, o.tags, o.status, o.created_at, o.updated_at,
        SUBSTR(o.body, 1, 300) AS excerpt,
        u.id AS author_id, u.username AS author
      FROM opinions o
      JOIN users u ON o.user_id = u.id
      WHERE o.status = 'published'
        ${username ? "AND LOWER(u.username) = LOWER(?)" : ""}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...(username ? [username] : []), limit, offset);

    const total = username
      ? db.prepare("SELECT COUNT(*) AS c FROM opinions o JOIN users u ON o.user_id = u.id WHERE o.status = 'published' AND LOWER(u.username) = LOWER(?)").get(username).c
      : db.prepare("SELECT COUNT(*) AS c FROM opinions WHERE status = 'published'").get().c;

    const formatted = rows.map(r => ({
      ...r,
      tags: tryParse(r.tags, []),
      excerpt: r.excerpt && r.excerpt.length === 300
        ? r.excerpt.slice(0, r.excerpt.lastIndexOf(' ')) + '…'
        : (r.excerpt || ''),
    }));

    sendSuccess(res, { opinions: formatted, total });
  } catch (err) {
    sendError(res, err.message);
  }
});

router.get('/:id', optionalAuth, (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare(`
      SELECT o.*, u.username AS author, u.id AS author_id
      FROM opinions o
      JOIN users u ON o.user_id = u.id
      WHERE o.id = ? AND o.status = 'published'
    `).get(req.params.id);
    if (!row) return sendError(res, 'Opinion not found', 404);
    sendSuccess(res, { ...row, tags: tryParse(row.tags, []) });
  } catch (err) {
    sendError(res, err.message);
  }
});

const opinionValidation = [
  body('title').trim().isLength({ min: 3, max: 200 }).withMessage('Title must be 3–200 characters'),
  body('body').trim().isLength({ min: 10, max: 50000 }).withMessage('Body must be at least 10 characters'),
  body('tags').optional().isArray({ max: 10 }).withMessage('Max 10 tags'),
  body('tags.*').optional().trim().isLength({ min: 1, max: 30 }),
];

router.post('/', requireAuth, opinionValidation, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return sendError(res, errors.array()[0].msg, 400);

  try {
    const db = getDb();
    const { title, body: text, tags = [] } = req.body;
    const result = db.prepare(
      'INSERT INTO opinions (user_id, title, body, tags) VALUES (?, ?, ?, ?)'
    ).run(req.user.id, title.trim(), text.trim(), JSON.stringify(tags));

    const opinion = db.prepare(`
      SELECT o.*, u.username AS author, u.id AS author_id
      FROM opinions o JOIN users u ON o.user_id = u.id WHERE o.id = ?
    `).get(result.lastInsertRowid);

    sendSuccess(res, { ...opinion, tags: tryParse(opinion.tags, []) }, 201);
  } catch (err) {
    sendError(res, err.message);
  }
});

router.patch('/:id', requireAuth, opinionValidation, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return sendError(res, errors.array()[0].msg, 400);

  try {
    const db = getDb();
    const opinion = db.prepare('SELECT * FROM opinions WHERE id = ?').get(req.params.id);
    if (!opinion) return sendError(res, 'Opinion not found', 404);
    if (opinion.user_id !== req.user.id && req.user.role !== 'admin') {
      return sendError(res, 'Not authorized', 403);
    }
    const { title, body: text, tags = [] } = req.body;
    db.prepare(
      'UPDATE opinions SET title = ?, body = ?, tags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(title.trim(), text.trim(), JSON.stringify(tags), opinion.id);

    const updated = db.prepare(`
      SELECT o.*, u.username AS author, u.id AS author_id
      FROM opinions o JOIN users u ON o.user_id = u.id WHERE o.id = ?
    `).get(opinion.id);

    sendSuccess(res, { ...updated, tags: tryParse(updated.tags, []) });
  } catch (err) {
    sendError(res, err.message);
  }
});

router.delete('/:id', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const opinion = db.prepare('SELECT * FROM opinions WHERE id = ?').get(req.params.id);
    if (!opinion) return sendError(res, 'Opinion not found', 404);
    if (opinion.user_id !== req.user.id && req.user.role !== 'admin') {
      return sendError(res, 'Not authorized', 403);
    }
    db.prepare('DELETE FROM opinions WHERE id = ?').run(opinion.id);
    sendSuccess(res, { deleted: true });
  } catch (err) {
    sendError(res, err.message);
  }
});

function tryParse(val, fallback) {
  try { return JSON.parse(val); } catch { return fallback; }
}

export default router;
