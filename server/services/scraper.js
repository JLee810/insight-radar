import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

/* ── Public API ───────────────────────────────────────────────────────────── */

/**
 * Scrape article metadata and content from a URL.
 * @param {string} url
 * @returns {Promise<{title:string,content:string,author:string|null,publishedAt:string|null,description:string|null}>}
 */
export async function scrapeArticle(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    timeout: 20000,
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
 * Discover article links + optional prefetched metadata for a website.
 * Strategy: try RSS feed first (fast, reliable), fall back to HTML scraping.
 *
 * @param {string} siteUrl - Homepage or section URL
 * @returns {Promise<Array<{url:string,title?:string,description?:string,publishedAt?:string}>>}
 */
export async function discoverWithMetadata(siteUrl) {
  // 1. Try to find and parse an RSS/Atom feed
  try {
    const feedUrl = await findRssFeedUrl(siteUrl);
    if (feedUrl) {
      const items = await parseRssFeed(feedUrl);
      if (items.length > 0) {
        console.log(`  [rss] Found ${items.length} items via ${feedUrl}`);
        return items.slice(0, 50);
      }
    }
  } catch (err) {
    console.warn(`  [rss] Feed attempt failed for ${siteUrl}: ${err.message}`);
  }

  // 2. Fall back to HTML link discovery
  const links = await discoverArticleLinks(siteUrl);
  return links.map(url => ({ url }));
}

/**
 * Discover article links on a website's front page (HTML scraping).
 * @param {string} siteUrl
 * @returns {Promise<string[]>}
 */
export async function discoverArticleLinks(siteUrl) {
  try {
    const response = await fetch(siteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: 20000,
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
        if (resolved.startsWith(base.origin) && looksLikeArticle(resolved)) {
          links.add(resolved);
        }
      } catch { /* Invalid URL — skip */ }
    });

    return [...links].slice(0, 50);
  } catch {
    return [];
  }
}

/* ── RSS discovery & parsing ─────────────────────────────────────────────── */

/**
 * Well-known RSS feed paths to probe for a given site.
 */
const RSS_PATHS = [
  '/feed', '/feed/', '/rss', '/rss/', '/rss.xml', '/feed.xml', '/atom.xml',
  '/feeds/all.atom.xml', '/feeds/posts/default', '/index.xml',
  '/news/rss', '/news/rss.xml', '/en/rss.xml', '/en/feeds/all.atom.xml',
  '/articles/feed', '/blog/feed', '/blog/rss.xml',
];

/**
 * Try to find the RSS/Atom feed URL for a site.
 * First checks <link rel="alternate"> in the homepage HTML, then probes common paths.
 * @param {string} siteUrl
 * @returns {Promise<string|null>}
 */
async function findRssFeedUrl(siteUrl) {
  const base = new URL(siteUrl);

  // 1. Fetch homepage and look for <link rel="alternate" type="application/rss+xml">
  try {
    const res = await fetch(siteUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; InsightRadar/1.0)' },
      timeout: 15000,
    });
    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);
      const feedHref =
        $('link[rel="alternate"][type="application/rss+xml"]').first().attr('href') ||
        $('link[rel="alternate"][type="application/atom+xml"]').first().attr('href');
      if (feedHref) {
        return new URL(feedHref, base).href;
      }
    }
  } catch { /* ignore */ }

  // 2. Probe well-known paths
  for (const path of RSS_PATHS) {
    const url = `${base.origin}${path}`;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; InsightRadar/1.0)' },
        timeout: 8000,
      });
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('xml') || contentType.includes('rss') || contentType.includes('atom')) {
          return url;
        }
        // Some servers return text/html for RSS — check the content
        const text = await res.text();
        if (text.includes('<rss') || text.includes('<feed') || text.includes('<channel>')) {
          return url;
        }
      }
    } catch { /* try next path */ }
  }

  return null;
}

/**
 * Parse an RSS or Atom feed and return article metadata.
 * @param {string} feedUrl
 * @returns {Promise<Array<{url:string,title:string,description:string,publishedAt:string|null}>>}
 */
async function parseRssFeed(feedUrl) {
  const res = await fetch(feedUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; InsightRadar/1.0)' },
    timeout: 15000,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching feed ${feedUrl}`);

  const xml = await res.text();
  const $ = cheerio.load(xml, { xmlMode: true });

  const items = [];

  // RSS 2.0 format: <item> elements
  $('item').each((_, el) => {
    const $el = $(el);
    const url = ($el.find('link').text().trim() ||
                 $el.find('guid').text().trim() ||
                 $el.find('link').attr('href') || '').trim();
    if (!url || !url.startsWith('http')) return;

    const pubDate = $el.find('pubDate').text().trim() ||
                    $el.find('dc\\:date').text().trim() || null;

    items.push({
      url,
      title: $el.find('title').text().trim() || '',
      description: $el.find('description').text().trim().replace(/<[^>]*>/g, '') || '',
      publishedAt: pubDate ? safeDate(pubDate) : null,
    });
  });

  // Atom format: <entry> elements
  if (items.length === 0) {
    $('entry').each((_, el) => {
      const $el = $(el);
      const url = $el.find('link[rel="alternate"]').attr('href') ||
                  $el.find('link').attr('href') || '';
      if (!url || !url.startsWith('http')) return;

      const published = $el.find('published').text().trim() ||
                        $el.find('updated').text().trim() || null;

      items.push({
        url,
        title: $el.find('title').text().trim() || '',
        description: $el.find('summary').text().trim() || $el.find('content').text().trim() || '',
        publishedAt: published ? safeDate(published) : null,
      });
    });
  }

  return items.filter(item => item.url);
}

/** Safely parse a date string, returning ISO string or null. */
function safeDate(str) {
  try {
    const d = new Date(str);
    return isNaN(d) ? null : d.toISOString();
  } catch { return null; }
}

/* ── HTML scraping helpers ────────────────────────────────────────────────── */

/**
 * Determine if a URL path looks like an article.
 * Relaxed version: allows more URL patterns.
 * @param {string} url
 * @returns {boolean}
 */
function looksLikeArticle(url) {
  try {
    const parsed = new URL(url);
    const { pathname, search } = parsed;

    // Skip root and empty paths
    if (pathname === '/' || pathname === '') return false;

    // Skip static assets
    if (/\.(css|js|png|jpg|jpeg|gif|svg|ico|pdf|zip|woff|mp4|webp|avif|ttf|eot)$/i.test(pathname)) return false;

    // Skip XML/JSON feeds
    if (/\.(xml|json|rss|atom)$/i.test(pathname)) return false;

    // Skip tracking query strings
    if (search && /utm_|promo=|ref=|source=/i.test(search)) return false;

    // Skip known non-article path patterns
    if (/\/(tag|category|author|page\/\d|search|events?\/(?!.*-\w)|about|contact|subscribe|newsletter|login|signup|terms|privacy|advertise|sponsor|jobs?|careers?|press|podcast)\/?$/i.test(pathname)) return false;

    const parts = pathname.split('/').filter(Boolean);

    // Single segment ≤ 3 chars is almost always a section (e.g. /en, /us)
    if (parts.length === 1 && parts[0].length <= 3) return false;

    const last = parts[parts.length - 1];

    // Must have some meaningful content in the last segment
    if (last.length < 4) return false;

    // Pure numeric IDs are fine if they appear after a path (e.g. /articles/12345)
    if (/^\d+$/.test(last) && parts.length < 2) return false;

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
    $('meta[property="og:title"]').attr('content')?.trim() ||
    $('meta[name="twitter:title"]').attr('content')?.trim() ||
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
  $('script, style, nav, header, footer, aside, .ad, .advertisement, .sidebar, .comments, .related, [class*="promo"], [class*="banner"]').remove();

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
    '.page-content',
    '.main-content',
    '#main',
  ];

  for (const sel of selectors) {
    const el = $(sel).first();
    if (el.length) {
      const text = el.text().replace(/\s+/g, ' ').trim();
      if (text.length > 200) return text.substring(0, 8000);
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
  ) || null;
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
    $('meta[name="DC.date"]').attr('content'),
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
