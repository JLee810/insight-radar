import cron from 'node-cron';
import { getDb } from '../db/database.js';
import { discoverWithMetadata, scrapeArticle } from './scraper.js';
import { analyzeArticle } from './ai-analyzer.js';
import { analyzeBias } from './bias-analyzer.js';
import { fetchSocialPosts } from './social-scraper.js';
import { checkSocialRelevance } from './ai-analyzer.js';

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

  // Refresh social sources every 2 hours
  cron.schedule('0 */2 * * *', refreshSocialSources);

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
    const items = await discoverWithMetadata(website.url);
    const interests = db.prepare('SELECT keyword FROM interests').all().map(r => r.keyword);

    for (const item of items) {
      const link = item.url;
      // Skip already-known articles
      const exists = db.prepare('SELECT id FROM articles WHERE url = ?').get(link);
      if (exists) continue;

      try {
        // Try full scrape first; fall back to prefetched RSS metadata on failure
        let scraped;
        try {
          scraped = await scrapeArticle(link);
          // If scrape returned a near-empty title but RSS gave us a real one, prefer RSS
          if (item.title && (!scraped.title || scraped.title === 'Untitled')) {
            scraped.title = item.title;
          }
          if (item.description && !scraped.description) {
            scraped.description = item.description;
          }
          if (item.publishedAt && !scraped.publishedAt) {
            scraped.publishedAt = item.publishedAt;
          }
        } catch (scrapeErr) {
          // Scrape failed — use RSS metadata as fallback if available
          if (!item.title) throw scrapeErr; // nothing to fall back to
          scraped = {
            title: item.title,
            content: item.description || '',
            description: item.description || null,
            author: null,
            publishedAt: item.publishedAt || null,
          };
        }

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

/**
 * Refresh all active social sources — fetch new posts, run AI topic filter.
 */
async function refreshSocialSources() {
  try {
    const db = getDb();
    const sources = db.prepare('SELECT * FROM social_sources WHERE is_active = 1').all();
    if (!sources.length) return;

    console.log(`[social] Refreshing ${sources.length} source(s)…`);

    const insert = db.prepare(`
      INSERT INTO social_posts
        (source_id, platform, external_id, author, handle, content, url,
         likes, shares, comments, media_url, posted_at, topic_category, relevance_score, is_relevant)
      VALUES
        (@source_id, @platform, @external_id, @author, @handle, @content, @url,
         @likes, @shares, @comments, @media_url, @posted_at, @topic_category, @relevance_score, @is_relevant)
    `);

    for (const source of sources) {
      try {
        const posts = await fetchSocialPosts(source);

        for (const post of posts) {
          const exists = db.prepare('SELECT id FROM social_posts WHERE external_id = ?').get(post.external_id);
          if (exists) continue;

          let topic_category = 'other', relevance_score = 0, is_relevant = 0;
          try {
            const check = await checkSocialRelevance({ content: `${post.title || ''} ${post.content || ''}` });
            topic_category  = check.category;
            relevance_score = check.relevance_score;
            is_relevant     = check.is_relevant && check.relevance_score >= 35 ? 1 : 0;
          } catch { /* keep defaults */ }

          const { lastInsertRowid } = insert.run({
            source_id: source.id, platform: source.platform,
            external_id: post.external_id,
            author:   (post.author  || '').slice(0, 100),
            handle:   (post.handle  || '').slice(0, 100),
            content:  (post.content || '').slice(0, 2000),
            url: post.url || '', likes: post.likes || 0,
            shares: post.shares || 0, comments: post.comments || 0,
            media_url: post.media_url || null, posted_at: post.posted_at || null,
            topic_category, relevance_score, is_relevant,
          });

          if (is_relevant) {
            analyzeBias({ title: post.title || (post.content || '').slice(0, 120), content: post.content || '' })
              .then(b => db.prepare('UPDATE social_posts SET bias_data = ? WHERE id = ?').run(JSON.stringify(b), lastInsertRowid))
              .catch(() => {});
          }

          await sleep(500); // be respectful
        }

        db.prepare('UPDATE social_sources SET last_checked = CURRENT_TIMESTAMP WHERE id = ?').run(source.id);
      } catch (err) {
        console.warn(`[social] Failed to refresh source #${source.id}: ${err.message}`);
      }
    }
  } catch (err) {
    console.error('[social] Refresh error:', err.message);
  }
}

/** @param {number} ms */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
