import cron from 'node-cron';
import { getDb } from '../db/database.js';
import { discoverArticleLinks, scrapeArticle } from './scraper.js';
import { analyzeArticle } from './ai-analyzer.js';
import { analyzeBias } from './bias-analyzer.js';

// Map of website_id → cron task instance
const tasks = new Map();

/**
 * Start the scheduler. Loads all active websites and schedules a check
 * for each one based on their check_interval. Also runs a master tick
 * every minute to pick up newly added websites.
 */
export function startScheduler() {
  // Master tick: every minute, reconcile DB websites with running tasks
  cron.schedule('* * * * *', reconcileTasks);
  console.log('Scheduler started.');
  reconcileTasks(); // Run immediately on startup
}

/**
 * Reconcile running cron tasks with the current DB state.
 * Adds tasks for new active websites, removes tasks for deleted/inactive ones.
 */
async function reconcileTasks() {
  try {
    const db = getDb();
    const websites = db.prepare('SELECT * FROM websites WHERE is_active = 1').all();
    const activeIds = new Set(websites.map(w => w.id));

    // Remove tasks for websites that are no longer active
    for (const [id, task] of tasks) {
      if (!activeIds.has(id)) {
        task.stop();
        tasks.delete(id);
      }
    }

    // Add tasks for new active websites
    for (const website of websites) {
      if (!tasks.has(website.id)) {
        scheduleWebsite(website);
      }
    }
  } catch (err) {
    console.error('Scheduler reconcile error:', err.message);
  }
}

/**
 * Schedule a cron job for a single website.
 * Converts check_interval (seconds) to the closest supported cron expression.
 * @param {{ id: number, url: string, name: string, check_interval: number }} website
 */
function scheduleWebsite(website) {
  const intervalMinutes = Math.max(1, Math.floor(website.check_interval / 60));
  // node-cron doesn't support "every N minutes" directly for all values, so we
  // approximate: intervals < 60 min → run every N minutes; >= 60 → hourly/daily.
  let cronExpr;
  if (intervalMinutes < 60) {
    cronExpr = `*/${intervalMinutes} * * * *`;
  } else {
    const hours = Math.floor(intervalMinutes / 60);
    cronExpr = hours >= 24 ? '0 0 * * *' : `0 */${hours} * * *`;
  }

  const task = cron.schedule(cronExpr, () => checkWebsite(website.id), { scheduled: true });
  tasks.set(website.id, task);
  console.log(`Scheduled website #${website.id} (${website.name}) — ${cronExpr}`);
}

/**
 * Run a single website check: discover links, scrape new articles, analyze each.
 * @param {number} websiteId
 */
async function checkWebsite(websiteId) {
  const db = getDb();
  const website = db.prepare('SELECT * FROM websites WHERE id = ?').get(websiteId);
  if (!website) return;

  console.log(`Checking website: ${website.name} (${website.url})`);

  let articlesFound = 0;
  let status = 'success';
  let errorMessage = null;

  try {
    const links = await discoverArticleLinks(website.url);
    const interests = db.prepare('SELECT keyword FROM interests').all().map(r => r.keyword);

    for (const link of links) {
      // Skip already-known articles
      const exists = db.prepare('SELECT id FROM articles WHERE url = ?').get(link);
      if (exists) continue;

      try {
        const scraped = await scrapeArticle(link);
        let aiResult = { summary: '', relevance_score: 0, tags: [], insight: '' };

        if (interests.length > 0) {
          aiResult = await analyzeArticle(scraped, interests);
        }

        const insertResult = db.prepare(`
          INSERT INTO articles (website_id, url, title, content, summary, relevance_score, ai_tags, ai_insights, published_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          websiteId,
          link,
          scraped.title,
          scraped.content,
          aiResult.summary,
          aiResult.relevance_score,
          JSON.stringify(aiResult.tags || []),
          aiResult.insight,
          scraped.publishedAt || null
        );

        // Run bias analysis in background — non-blocking
        const newArticleId = insertResult.lastInsertRowid;
        analyzeBias({ title: scraped.title, content: scraped.content || '' })
          .then(biasResult => {
            db.prepare('UPDATE articles SET bias_data = ? WHERE id = ?')
              .run(JSON.stringify(biasResult), newArticleId);
          })
          .catch(() => { /* bias is optional */ });

        articlesFound++;
        // Small delay to be respectful to sites and avoid rate limits
        await sleep(1500);
      } catch (articleErr) {
        console.warn(`  Skipping ${link}: ${articleErr.message}`);
      }
    }

    // Update last_checked
    db.prepare('UPDATE websites SET last_checked = CURRENT_TIMESTAMP WHERE id = ?').run(websiteId);
  } catch (err) {
    status = 'error';
    errorMessage = err.message;
    console.error(`Website check failed for #${websiteId}:`, err.message);
  }

  // Log the run
  db.prepare(`
    INSERT INTO tracking_log (website_id, articles_found, status, error_message)
    VALUES (?, ?, ?, ?)
  `).run(websiteId, articlesFound, status, errorMessage);

  console.log(`  Done — ${articlesFound} new articles found`);
}

/**
 * Trigger an immediate check for a specific website (used by API).
 * @param {number} websiteId
 */
export async function triggerCheck(websiteId) {
  return checkWebsite(websiteId);
}

/** @param {number} ms */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
