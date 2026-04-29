import { describe, expect, it } from 'vitest';
import { normalizeImageUrls } from '../../../src/utils/normalizeImageUrls.js';

describe('normalizeImageUrls', () => {
  it('prefers non-empty imageUrls arrays', () => {
    expect(
      normalizeImageUrls({
        imageUrl: 'fallback.webp',
        imageUrls: ['one.webp', '', 'two.webp'],
      })
    ).toEqual(['one.webp', 'two.webp']);
  });

  it('falls back to imageUrl when imageUrls is missing or empty', () => {
    expect(normalizeImageUrls({ imageUrl: 'single.webp' })).toEqual(['single.webp']);
    expect(normalizeImageUrls({ imageUrl: 'single.webp', imageUrls: [] })).toEqual([
      'single.webp',
    ]);
  });

  it('returns an empty array when no image data exists', () => {
    expect(normalizeImageUrls({})).toEqual([]);
    expect(normalizeImageUrls(null)).toEqual([]);
  });
});
