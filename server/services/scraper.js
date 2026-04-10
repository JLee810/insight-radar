import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

/**
 * Scrape article metadata and content from a URL.
 * @param {string} url
 * @returns {Promise<{title: string, content: string, author: string|null, publishedAt: string|null, description: string|null}>}
 */
export async function scrapeArticle(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; InsightRadar/1.0; +https://github.com/insightradar)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    timeout: 15000,
  });

  if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);

  const html = await response.text();
  const $ = cheerio.load(html);

  return {
    title: extractTitle($),
    content: extractContent($),
    author: extractAuthor($),
    publishedAt: extractDate($),
    description: extractDescription($),
  };
}

/**
 * Discover article links on a website's front page.
 * @param {string} siteUrl - Homepage or section URL
 * @returns {Promise<string[]>} List of absolute article URLs
 */
export async function discoverArticleLinks(siteUrl) {
  try {
    const response = await fetch(siteUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; InsightRadar/1.0)' },
      timeout: 15000,
    });
    if (!response.ok) return [];

    const html = await response.text();
    const $ = cheerio.load(html);
    const base = new URL(siteUrl);
    const links = new Set();

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      try {
        const resolved = new URL(href, base).href;
        // Only keep same-origin links that look like articles
        if (resolved.startsWith(base.origin) && looksLikeArticle(resolved)) {
          links.add(resolved);
        }
      } catch {
        // Invalid URL — skip
      }
    });

    return [...links].slice(0, 50); // Cap at 50 per check
  } catch {
    return [];
  }
}

// ─── Private helpers ───────────────────────────────────────────────────────────

/**
 * Determine if a URL path looks like an article (has a slug/path depth).
 * @param {string} url
 * @returns {boolean}
 */
function looksLikeArticle(url) {
  try {
    const parsed = new URL(url);
    const { pathname, search } = parsed;

    // Skip URLs with tracking query strings (UTM params, ads, promos)
    if (search && /utm_|promo=|ref=|source=/i.test(search)) return false;

    // Skip root and empty paths
    if (pathname === '/' || pathname === '') return false;

    // Skip static assets
    if (/\.(css|js|png|jpg|jpeg|gif|svg|ico|pdf|zip|xml|json|woff|mp4)$/i.test(pathname)) return false;

    // Skip known non-article path segments anywhere in the URL
    if (/\/(tag|category|author|page|search|feed|events?|about|contact|subscribe|newsletter|login|signup|terms|privacy|advertise|latest|trending|sponsor|partner|jobs?|careers?|press|media|podcast)\//i.test(pathname)) return false;
    // Also skip paths that END with these words (e.g. /latest, /trending)
    if (/\/(tag|category|author|search|feed|events?|about|contact|subscribe|latest|trending)\/?$/i.test(pathname)) return false;

    const parts = pathname.split('/').filter(Boolean);

    // Skip single-segment paths that look like sections (e.g. /technology, /world)
    if (parts.length < 2) return false;

    const last = parts[parts.length - 1];

    // Must have a meaningful slug (hyphenated, >8 chars, not just a number)
    if (last.length < 8) return false;
    if (/^\d+$/.test(last)) return false; // pure numeric IDs without slug
    if (!/-/.test(last) && !/[A-Z]/.test(last) && last.length < 15) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * Extract the article title from multiple sources, in priority order.
 * @param {cheerio.CheerioAPI} $
 * @returns {string}
 */
function extractTitle($) {
  return (
    $('meta[property="og:title"]').attr('content') ||
    $('meta[name="twitter:title"]').attr('content') ||
    $('h1').first().text().trim() ||
    $('title').text().trim() ||
    'Untitled'
  );
}

/**
 * Extract the main body text of an article.
 * @param {cheerio.CheerioAPI} $
 * @returns {string}
 */
function extractContent($) {
  // Remove noise
  $('script, style, nav, header, footer, aside, .ad, .advertisement, .sidebar, .comments, .related').remove();

  // Try semantic containers in order of specificity
  const selectors = [
    'article',
    '[role="main"]',
    'main',
    '.post-content',
    '.article-content',
    '.entry-content',
    '.content',
    '#content',
    '.story-body',
    '.article-body',
  ];

  for (const sel of selectors) {
    const el = $(sel).first();
    if (el.length) {
      const text = el.text().replace(/\s+/g, ' ').trim();
      if (text.length > 200) return text;
    }
  }

  // Fallback: body text
  return $('body').text().replace(/\s+/g, ' ').trim().substring(0, 5000);
}

/**
 * Extract the author name from common meta patterns.
 * @param {cheerio.CheerioAPI} $
 * @returns {string|null}
 */
function extractAuthor($) {
  return (
    $('meta[name="author"]').attr('content') ||
    $('meta[property="article:author"]').attr('content') ||
    $('[rel="author"]').first().text().trim() ||
    $('[class*="author"] [class*="name"]').first().text().trim() ||
    null
  );
}

/**
 * Extract the publish date from meta tags and structured data.
 * @param {cheerio.CheerioAPI} $
 * @returns {string|null}
 */
function extractDate($) {
  const candidates = [
    $('meta[property="article:published_time"]').attr('content'),
    $('meta[name="date"]').attr('content'),
    $('time[datetime]').first().attr('datetime'),
    $('time').first().attr('datetime'),
  ];

  for (const candidate of candidates) {
    if (candidate) {
      const d = new Date(candidate);
      if (!isNaN(d)) return d.toISOString();
    }
  }
  return null;
}

/**
 * Extract the meta description.
 * @param {cheerio.CheerioAPI} $
 * @returns {string|null}
 */
function extractDescription($) {
  return (
    $('meta[property="og:description"]').attr('content') ||
    $('meta[name="description"]').attr('content') ||
    null
  );
}
