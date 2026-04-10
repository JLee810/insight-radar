import Anthropic from '@anthropic-ai/sdk';

// Lazy-initialize so dotenv has already run before the client reads the env var
let _client = null;
function getClient() {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

/**
 * Analyze an article against the user's interests using Claude AI.
 * @param {{ title: string, content?: string }} article
 * @param {string[]} userInterests - List of interest keywords
 * @returns {Promise<{ summary: string, relevance_score: number, tags: string[], insight: string }>}
 */
export async function analyzeArticle(article, userInterests) {
  const contentPreview = article.content?.substring(0, 3000) || '';

  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: `You are an article analysis AI. Given an article and user interests, provide:
1. A 2-3 sentence summary capturing the core idea
2. A relevance score 0-100 based on how well it matches the user's interests
3. Key tags/topics (3-7 tags, lowercase, concise)
4. A brief insight on why this matters to someone with these interests

ALWAYS respond with valid JSON only. No markdown, no code blocks, just raw JSON.`,
    messages: [
      {
        role: 'user',
        content: `Analyze this article:

Title: ${article.title}
Content: ${contentPreview}

User interests: ${userInterests.join(', ')}

Respond with JSON exactly like:
{
  "summary": "...",
  "relevance_score": 75,
  "tags": ["tag1", "tag2", "tag3"],
  "insight": "..."
}`,
      },
    ],
  });

  const raw = response.content[0].text.trim();
  try {
    const parsed = JSON.parse(raw);
    return {
      summary: parsed.summary || '',
      relevance_score: Math.min(100, Math.max(0, Number(parsed.relevance_score) || 0)),
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 10) : [],
      insight: parsed.insight || '',
    };
  } catch {
    // If JSON parsing fails, return a minimal result
    return { summary: raw.substring(0, 300), relevance_score: 0, tags: [], insight: '' };
  }
}

/**
 * Generate a weekly digest of trends from a set of recent articles.
 * @param {Array<{ title: string, summary: string, ai_tags: string[] }>} articles
 * @returns {Promise<{ trends: string[], digest: string, topTopics: string[] }>}
 */
export async function generateWeeklyDigest(articles) {
  if (!articles.length) return { trends: [], digest: 'No articles this week.', topTopics: [] };

  const articleSummaries = articles
    .slice(0, 30)
    .map((a, i) => `${i + 1}. ${a.title}: ${a.summary || ''}`)
    .join('\n');

  const response = await getClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: 'You are an AI that synthesizes content trends from article collections. Respond with valid JSON only.',
    messages: [
      {
        role: 'user',
        content: `Analyze these recent articles and identify trends:

${articleSummaries}

Respond with JSON:
{
  "trends": ["trend1", "trend2", "trend3"],
  "digest": "2-3 paragraph narrative summary of what's been happening this week",
  "topTopics": ["topic1", "topic2", "topic3", "topic4", "topic5"]
}`,
      },
    ],
  });

  try {
    return JSON.parse(response.content[0].text.trim());
  } catch {
    return { trends: [], digest: response.content[0].text, topTopics: [] };
  }
}
