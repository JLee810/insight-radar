import { Router } from 'express';
import { getDb } from '../db/database.js';
import { sendSuccess, sendError, formatArticle } from '../utils/helpers.js';
import { analyzeArticle } from '../services/ai-analyzer.js';
import { scrapeArticle } from '../services/scraper.js';

const router = Router();

/**
 * GET /api/articles
 * List articles with optional filters: website_id, is_read, is_bookmarked,
 * min_score, search, sort, order, limit, offset.
 */
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const {
      website_id,
      is_read,
      is_bookmarked,
      min_score = 0,
      search,
      sort = 'discovered_at',
      order = 'DESC',
      limit = 20,
      offset = 0,
    } = req.query;

    const allowedSorts = ['discovered_at', 'relevance_score', 'published_at', 'title'];
    const safeSort = allowedSorts.includes(sort) ? sort : 'discovered_at';
    const safeOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // node:sqlite does not support named params in LIMIT/OFFSET — use safe integer interpolation
    const safeLimit = Math.min(Math.max(1, parseInt(limit, 10) || 20), 200);
    const safeOffset = Math.max(0, parseInt(offset, 10) || 0);

    let where = ['a.relevance_score >= @min_score'];
    const params = { min_score: Number(min_score) };

    if (website_id) { where.push('a.website_id = @website_id'); params.website_id = Number(website_id); }
    if (is_read !== undefined) { where.push('a.is_read = @is_read'); params.is_read = is_read === 'true' ? 1 : 0; }
    if (is_bookmarked !== undefined) { where.push('a.is_bookmarked = @is_bookmarked'); params.is_bookmarked = is_bookmarked === 'true' ? 1 : 0; }
    if (search) { where.push("(a.title LIKE @search OR a.summary LIKE @search)"); params.search = `%${search}%`; }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const rows = db.prepare(`
      SELECT a.*, w.name as website_name, w.url as website_url
      FROM articles a
      LEFT JOIN websites w ON a.website_id = w.id
      ${whereClause}
      ORDER BY a.${safeSort} ${safeOrder}
      LIMIT ${safeLimit} OFFSET ${safeOffset}
    `).all(params);

    const total = db.prepare(`
      SELECT COUNT(*) as count FROM articles a ${whereClause}
    `).get(params);

    sendSuccess(res, { articles: rows.map(formatArticle), total: total.count, limit: safeLimit, offset: safeOffset });
  } catch (err) {
    sendError(res, err.message);
  }
});

/**
 * GET /api/articles/:id
 * Get a single article with full AI insights.
 */
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare(`
      SELECT a.*, w.name as website_name, w.url as website_url
      FROM articles a
      LEFT JOIN websites w ON a.website_id = w.id
      WHERE a.id = ?
    `).get(req.params.id);

    if (!row) return sendError(res, 'Article not found', 404);
    sendSuccess(res, formatArticle(row));
  } catch (err) {
    sendError(res, err.message);
  }
});

/**
 * POST /api/articles
 * Add an article manually (from Chrome extension). Scrapes + AI-analyzes it.
 */
router.post('/', async (req, res) => {
  try {
    const db = getDb();
    const { url, website_id } = req.body;
    if (!url) return sendError(res, 'url is required', 400);

    // Check for duplicate
    const existing = db.prepare('SELECT id FROM articles WHERE url = ?').get(url);
    if (existing) return sendSuccess(res, formatArticle(db.prepare('SELECT * FROM articles WHERE id = ?').get(existing.id)), 200);

    // Scrape the article
    const scraped = await scrapeArticle(url);

    // Get user interests for AI analysis
    const interests = db.prepare('SELECT keyword FROM interests').all().map(r => r.keyword);

    // AI analysis
    let aiResult = { summary: '', relevance_score: 0, tags: [], insight: '' };
    if (interests.length > 0) {
      aiResult = await analyzeArticle(scraped, interests);
    }

    const stmt = db.prepare(`
      INSERT INTO articles (website_id, url, title, content, summary, relevance_score, ai_tags, ai_insights, published_at)
      VALUES (@website_id, @url, @title, @content, @summary, @relevance_score, @ai_tags, @ai_insights, @published_at)
    `);

    const result = stmt.run({
      website_id: website_id || null,
      url,
      title: scraped.title,
      content: scraped.content,
      summary: aiResult.summary,
      relevance_score: aiResult.relevance_score,
      ai_tags: JSON.stringify(aiResult.tags || []),
      ai_insights: aiResult.insight,
      published_at: scraped.publishedAt || null,
    });

    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(result.lastInsertRowid);
    sendSuccess(res, formatArticle(article), 201);
  } catch (err) {
    sendError(res, err.message);
  }
});

/**
 * PATCH /api/articles/:id
 * Update read/bookmark status or other mutable fields.
 */
router.patch('/:id', (req, res) => {
  try {
    const db = getDb();
    const { is_read, is_bookmarked } = req.body;
    const updates = [];
    const params = {};

    if (is_read !== undefined) { updates.push('is_read = @is_read'); params.is_read = is_read ? 1 : 0; }
    if (is_bookmarked !== undefined) { updates.push('is_bookmarked = @is_bookmarked'); params.is_bookmarked = is_bookmarked ? 1 : 0; }

    if (!updates.length) return sendError(res, 'No valid fields to update', 400);

    params.id = req.params.id;
    db.prepare(`UPDATE articles SET ${updates.join(', ')} WHERE id = @id`).run(params);

    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
    if (!article) return sendError(res, 'Article not found', 404);
    sendSuccess(res, formatArticle(article));
  } catch (err) {
    sendError(res, err.message);
  }
});

/**
 * DELETE /api/articles/:id
 * Delete an article.
 */
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const result = db.prepare('DELETE FROM articles WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return sendError(res, 'Article not found', 404);
    sendSuccess(res, { deleted: true });
  } catch (err) {
    sendError(res, err.message);
  }
});

export default router;
