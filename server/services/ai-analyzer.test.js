import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted runs before vi.mock hoisting, making mockCreate available inside the factory
const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class Anthropic {
    constructor() {
      this.messages = { create: mockCreate };
    }
  },
}));

import { analyzeArticle } from './ai-analyzer.js';

describe('analyzeArticle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns parsed AI result with all fields', async () => {
    mockCreate.mockResolvedValue({
      content: [{ text: JSON.stringify({
        summary: 'This is a summary.',
        relevance_score: 85,
        tags: ['ai', 'technology', 'llm'],
        insight: 'Relevant because it covers AI.',
      }) }],
    });

    const result = await analyzeArticle(
      { title: 'AI advances in 2024', content: 'Large language models have...' },
      ['artificial intelligence', 'machine learning']
    );

    expect(result.summary).toBe('This is a summary.');
    expect(result.relevance_score).toBe(85);
    expect(result.tags).toEqual(['ai', 'technology', 'llm']);
    expect(result.insight).toBe('Relevant because it covers AI.');
  });

  it('clamps relevance_score above 100 to 100', async () => {
    mockCreate.mockResolvedValue({
      content: [{ text: JSON.stringify({ summary: '', relevance_score: 150, tags: [], insight: '' }) }],
    });

    const result = await analyzeArticle({ title: 'Test', content: '' }, ['test']);
    expect(result.relevance_score).toBe(100);
  });

  it('clamps relevance_score below 0 to 0', async () => {
    mockCreate.mockResolvedValue({
      content: [{ text: JSON.stringify({ summary: '', relevance_score: -10, tags: [], insight: '' }) }],
    });

    const result = await analyzeArticle({ title: 'Test', content: '' }, ['test']);
    expect(result.relevance_score).toBe(0);
  });

  it('handles invalid JSON gracefully', async () => {
    mockCreate.mockResolvedValue({
      content: [{ text: 'not valid json at all' }],
    });

    const result = await analyzeArticle({ title: 'Test', content: '' }, ['test']);
    expect(result.relevance_score).toBe(0);
    expect(result.tags).toEqual([]);
  });

  it('passes user interests to the AI prompt', async () => {
    mockCreate.mockResolvedValue({
      content: [{ text: JSON.stringify({ summary: '', relevance_score: 50, tags: [], insight: '' }) }],
    });

    await analyzeArticle({ title: 'Test', content: 'body' }, ['react', 'typescript']);

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.messages[0].content).toContain('react, typescript');
  });
});
