import { describe, it, expect } from 'vitest';
import { safeJsonParse, formatArticle, formatWebsite } from './helpers.js';

describe('safeJsonParse', () => {
  it('parses valid JSON', () => {
    expect(safeJsonParse('["a","b"]')).toEqual(['a', 'b']);
  });
  it('returns fallback on invalid JSON', () => {
    expect(safeJsonParse('not json', [])).toEqual([]);
  });
  it('returns fallback on null/undefined input', () => {
    expect(safeJsonParse(null, [])).toEqual([]);
    expect(safeJsonParse(undefined, {})).toEqual({});
  });
});

describe('formatArticle', () => {
  it('parses ai_tags JSON string', () => {
    const row = { id: 1, ai_tags: '["ai","tech"]', is_read: 0, is_bookmarked: 0 };
    const result = formatArticle(row);
    expect(result.ai_tags).toEqual(['ai', 'tech']);
  });
  it('converts is_read/is_bookmarked to booleans', () => {
    const row = { id: 1, ai_tags: null, is_read: 1, is_bookmarked: 0 };
    const result = formatArticle(row);
    expect(result.is_read).toBe(true);
    expect(result.is_bookmarked).toBe(false);
  });
  it('handles missing ai_tags gracefully', () => {
    const row = { id: 1, ai_tags: null, is_read: 0, is_bookmarked: 0 };
    expect(formatArticle(row).ai_tags).toEqual([]);
  });
});

describe('formatWebsite', () => {
  it('converts is_active to boolean', () => {
    expect(formatWebsite({ id: 1, is_active: 1 }).is_active).toBe(true);
    expect(formatWebsite({ id: 1, is_active: 0 }).is_active).toBe(false);
  });
});
