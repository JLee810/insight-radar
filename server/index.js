import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
// Always override — Windows may pre-set env vars as empty strings
const __serverDir = dirname(fileURLToPath(import.meta.url));
config({ path: join(__serverDir, '..', '.env'), override: true }); // project root
config({ path: join(__serverDir, '.env'),        override: true }); // server/ takes final precedence
import express from 'express';
import { helmetMiddleware, corsMiddleware, generalLimit, authLimit } from './middleware/security.js';
import { initDatabase, getDb } from './db/database.js';
import { runMigrations } from './db/migrations.js';
import { sendSuccess, sendError } from './utils/helpers.js';
import articlesRouter from './routes/articles.js';
import websitesRouter from './routes/websites.js';
import interestsRouter from './routes/interests.js';
import authRouter from './routes/auth.js';
import debateRouter from './routes/debate.js';
import biasRouter from './routes/bias.js';
import { analyzeArticle } from './services/ai-analyzer.js';
import { startScheduler } from './services/scheduler.js';
import { scrapeArticle } from './services/scraper.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(generalLimit);
app.use(express.json({ limit: '50kb' }));

// Health check — registered first so Railway healthcheck responds immediately
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// Mount routers
app.use('/api/auth', authLimit, authRouter);
app.use('/api/debate', debateRouter);
app.use('/api/bias', biasRouter);
app.use('/api/articles', articlesRouter);
app.use('/api/websites', websitesRouter);
app.use('/api/interests', interestsRouter);

/**
 * GET /api/stats
 * Dashboard statistics overview.
 */
app.get('/api/stats', (req, res) => {
  try {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];

    const stats = {
      totalArticles: db.prepare('SELECT COUNT(*) as c FROM articles').get().c,
      articlesToday: db.prepare("SELECT COUNT(*) as c FROM articles WHERE date(discovered_at) = date('now')").get().c,
      unreadCount: db.prepare('SELECT COUNT(*) as c FROM articles WHERE is_read = 0').get().c,
      bookmarkedCount: db.prepare('SELECT COUNT(*) as c FROM articles WHERE is_bookmarked = 1').get().c,
      avgRelevance: db.prepare('SELECT ROUND(AVG(relevance_score), 1) as avg FROM articles').get().avg || 0,
      websiteCount: db.prepare('SELECT COUNT(*) as c FROM websites WHERE is_active = 1').get().c,
      topTags: db.prepare(`
        SELECT ai_tags FROM articles
        WHERE ai_tags IS NOT NULL AND ai_tags != '[]'
        ORDER BY discovered_at DESC LIMIT 100
      `).all().flatMap(r => {
        try { return JSON.parse(r.ai_tags); } catch { return []; }
      }).reduce((acc, tag) => {
        acc[tag] = (acc[tag] || 0) + 1;
        return acc;
      }, {}),
    };

    // Convert topTags object to sorted array
    stats.topTags = Object.entries(stats.topTags)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    sendSuccess(res, stats);
  } catch (err) {
    sendError(res, err.message);
  }
});

/**
 * POST /api/analyze
 * Manually trigger AI analysis on an existing article.
 */
app.post('/api/analyze', async (req, res) => {
  try {
    const db = getDb();
    const { article_id, url } = req.body;
    if (!article_id && !url) return sendError(res, 'article_id or url is required', 400);

    let article;
    if (article_id) {
      article = db.prepare('SELECT * FROM articles WHERE id = ?').get(article_id);
      if (!article) return sendError(res, 'Article not found', 404);
    } else {
      const scraped = await scrapeArticle(url);
      article = { title: scraped.title, content: scraped.content };
    }

    const interests = db.prepare('SELECT keyword FROM interests').all().map(r => r.keyword);
    if (!interests.length) return sendError(res, 'No interests configured', 400);

    const aiResult = await analyzeArticle(article, interests);

    if (article_id) {
      db.prepare(`
        UPDATE articles SET summary = ?, relevance_score = ?, ai_tags = ?, ai_insights = ?
        WHERE id = ?
      `).run(aiResult.summary, aiResult.relevance_score, JSON.stringify(aiResult.tags || []), aiResult.insight, article_id);
    }

    sendSuccess(res, aiResult);
  } catch (err) {
    sendError(res, err.message);
  }
});

/**
 * GET /api/tracking-log
 * View website check history.
 */
app.get('/api/tracking-log', (req, res) => {
  try {
    const db = getDb();
    const { website_id, limit = 50 } = req.query;
    let query = `
      SELECT tl.*, w.name as website_name, w.url as website_url
      FROM tracking_log tl
      LEFT JOIN websites w ON tl.website_id = w.id
    `;
    const params = [];
    if (website_id) { query += ' WHERE tl.website_id = ?'; params.push(website_id); }
    query += ` ORDER BY tl.checked_at DESC LIMIT ?`;
    params.push(Number(limit));

    const rows = db.prepare(query).all(...params);
    sendSuccess(res, rows);
  } catch (err) {
    sendError(res, err.message);
  }
});

// 404 handler
app.use((req, res) => sendError(res, 'Not found', 404));

// Initialize DB, run migrations, start scheduler
initDatabase();
runMigrations();

// Safe column additions (ALTER TABLE IF NOT EXISTS not supported in SQLite)
try {
  const _db = getDb();
  _db.exec('ALTER TABLE articles ADD COLUMN bias_data TEXT');
} catch { /* column already exists */ }

startScheduler();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`InsightRadar server running on port ${PORT}`);
});
