import { describe, expect, it } from 'vitest';
import { slugify } from '../../../utils/slugify.js';

describe('slugify', () => {
  it('normalizes spaces and punctuation into a URL-safe slug', () => {
    expect(slugify(' Happy Colors Product! ')).toBe('happy-colors-product');
  });

  it('collapses repeated separators', () => {
    expect(slugify('red   blue --- green')).toBe('red-blue-green');
  });
});
