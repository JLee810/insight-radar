/**
 * Bias analyzer service.
 * Calls the Anthropic API to detect political/media bias in an article.
 */
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Analyzes an article for media/political bias.
 * @param {{ title: string, content: string, source?: string }} article
 * @returns {Promise<{
 *   lean: 'far-left'|'left'|'center-left'|'center'|'center-right'|'right'|'far-right'|'unknown',
 *   confidence: number,
 *   emotional_language: 'low'|'medium'|'high',
 *   factual_reporting: 'low'|'mixed'|'high',
 *   framing: string,
 *   reasoning: string
 * }>}
 */
export async function analyzeBias(article) {
  const prompt = `You are a neutral media-bias analyst. Analyze the following article for political and media bias.

Article title: ${article.title}
Source: ${article.source || 'Unknown'}
Content (first 1500 chars): ${(article.content || '').slice(0, 1500)}

Return ONLY valid JSON with these exact keys:
{
  "lean": one of ["far-left","left","center-left","center","center-right","right","far-right","unknown"],
  "confidence": integer 0-100 (how confident you are in the lean assessment),
  "emotional_language": one of ["low","medium","high"],
  "factual_reporting": one of ["low","mixed","high"],
  "framing": one-sentence description of how the story is framed (max 120 chars),
  "reasoning": two-sentence explanation of your bias assessment (max 250 chars)
}`;

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content[0].text.trim();
  // Extract JSON from response (handles markdown code blocks)
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Bias analyzer returned no JSON');

  const result = JSON.parse(match[0]);

  // Validate required fields
  const validLeans = ['far-left', 'left', 'center-left', 'center', 'center-right', 'right', 'far-right', 'unknown'];
  if (!validLeans.includes(result.lean)) result.lean = 'unknown';
  result.confidence = Math.max(0, Math.min(100, Number(result.confidence) || 0));

  return result;
}
