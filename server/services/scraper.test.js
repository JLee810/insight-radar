import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock node-fetch
vi.mock('node-fetch', () => ({
  default: vi.fn(),
}));

import fetch from 'node-fetch';
import { scrapeArticle, discoverArticleLinks } from './scraper.js';

const MOCK_HTML = `
<!doctype html>
<html>
<head>
  <title>Test Article Title</title>
  <meta property="og:title" content="OG Article Title" />
  <meta name="description" content="A short description." />
  <meta property="article:published_time" content="2024-01-15T10:00:00Z" />
  <meta name="author" content="Jane Doe" />
</head>
<body>
  <article>
    <h1>Article Heading</h1>
    <p>${'Lorem ipsum dolor sit amet. '.repeat(40)}</p>
  </article>
</body>
</html>
`;

function mockFetch(html, status = 200) {
  fetch.mockResolvedValue({
    ok: status < 400,
    status,
    text: async () => html,
  });
}

describe('scrapeArticle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('extracts OG title over page title', async () => {
    mockFetch(MOCK_HTML);
    const result = await scrapeArticle('https://example.com/article');
    expect(result.title).toBe('OG Article Title');
  });

  it('extracts author from meta tag', async () => {
    mockFetch(MOCK_HTML);
    const result = await scrapeArticle('https://example.com/article');
    expect(result.author).toBe('Jane Doe');
  });

  it('extracts published date as ISO string', async () => {
    mockFetch(MOCK_HTML);
    const result = await scrapeArticle('https://example.com/article');
    expect(result.publishedAt).toBe('2024-01-15T10:00:00.000Z');
  });

  it('extracts article content', async () => {
    mockFetch(MOCK_HTML);
    const result = await scrapeArticle('https://example.com/article');
    expect(result.content).toContain('Lorem ipsum');
    expect(result.content.length).toBeGreaterThan(100);
  });

  it('throws on HTTP error', async () => {
    mockFetch('', 404);
    await expect(scrapeArticle('https://example.com/notfound')).rejects.toThrow('HTTP 404');
  });
});

describe('discoverArticleLinks', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns article-like links from the same origin', async () => {
    const html = `
      <html><body>
        <a href="/2024/01/my-great-article">Article 1</a>
        <a href="/category/tech">Category</a>
        <a href="https://other.com/article">External</a>
        <a href="/page/2">Pagination</a>
      </body></html>
    `;
    mockFetch(html);
    const links = await discoverArticleLinks('https://example.com');
    expect(links).toContain('https://example.com/2024/01/my-great-article');
    expect(links).not.toContain('https://other.com/article');
  });

  it('returns empty array on fetch failure', async () => {
    fetch.mockRejectedValue(new Error('network error'));
    const links = await discoverArticleLinks('https://example.com');
    expect(links).toEqual([]);
  });
});
