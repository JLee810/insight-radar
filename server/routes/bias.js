/**
 * Bias routes.
 * GET /api/bias/:articleId — fetch or compute bias analysis for an article
 */
import { Router } from 'express';
import { getDb } from '../db/database.js';
import { sendSuccess, sendError } from '../utils/helpers.js';
import { analyzeBias } from '../services/bias-analyzer.js';

const router = Router();

/**
 * GET /api/bias/:articleId
 * Returns cached bias result or runs analysis and caches it.
 */
router.get('/:articleId', async (req, res) => {
  try {
    const db = getDb();
    const articleId = Number(req.params.articleId);
    if (!articleId) return sendError(res, 'Invalid article ID', 400);

    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(articleId);
    if (!article) return sendError(res, 'Article not found', 404);

    // Return cached result if available
    if (article.bias_data) {
      try {
        return sendSuccess(res, JSON.parse(article.bias_data));
      } catch { /* fall through to re-analyze */ }
    }

    // Run analysis
    if (!article.title && !article.content) {
      return sendError(res, 'Article has no content to analyze', 400);
    }

    const biasResult = await analyzeBias({
      title: article.title,
      content: article.content || '',
      source: article.website_name || '',
    });

    // Cache in articles table
    db.prepare('UPDATE articles SET bias_data = ? WHERE id = ?')
      .run(JSON.stringify(biasResult), articleId);

    sendSuccess(res, biasResult);
  } catch (err) {
    sendError(res, err.message);
  }
});

export default router;
