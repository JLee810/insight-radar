/**
 * GET /api/trending
 * Top 5 articles by debate activity (vote_count + comment count).
 */
import { Router } from 'express';
import { getDb } from '../db/database.js';
import { sendSuccess, sendError } from '../utils/helpers.js';

const router = Router();

router.get('/', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT
        a.id,
        a.title,
        a.url,
        a.published_at,
        a.discovered_at,
        w.name AS website_name,
        COALESCE(dt.vote_count, 0) AS vote_count,
        COALESCE(dt.status, 'voting') AS thread_status,
        COUNT(c.id) AS comment_count,
        COALESCE(dt.vote_count, 0) + COUNT(c.id) AS activity_score
      FROM articles a
      LEFT JOIN websites w ON a.website_id = w.id
      LEFT JOIN debate_threads dt ON dt.article_id = a.id
      LEFT JOIN comments c ON c.thread_id = dt.id AND c.is_deleted = 0
      GROUP BY a.id
      ORDER BY activity_score DESC
      LIMIT 5
    `).all();
    sendSuccess(res, rows);
  } catch (err) {
    sendError(res, err.message);
  }
});

export default router;
