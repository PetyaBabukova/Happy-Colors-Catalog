import { describe, expect, it } from 'vitest';
import {
  formatCount,
  formatMachineDateIso,
  formatVisibleDate,
} from '../../../src/i18n/formatters';

describe('i18n formatters', () => {
  it('formats visible dates as unambiguous dd.mm.yyyy for both locales', () => {
    expect(formatVisibleDate('2026-07-04')).toBe('04.07.2026');
    expect(formatVisibleDate(new Date('2026-07-04T12:30:00.000Z'))).toBe('04.07.2026');
  });

  it('keeps machine-readable dates in ISO 8601', () => {
    expect(formatMachineDateIso('2026-07-04')).toBe('2026-07-04T00:00:00.000Z');
    expect(formatMachineDateIso(new Date('2026-07-04T12:30:00.000Z'))).toBe(
      '2026-07-04T12:30:00.000Z'
    );
  });

  it('formats counts with locale-aware numbers and optional labels', () => {
    expect(formatCount(1234, 'en')).toBe('1,234');
    expect(formatCount(1, 'en', { one: 'product', other: 'products' })).toBe('1 product');
    expect(formatCount(2, 'en', { one: 'product', other: 'products' })).toBe('2 products');
  });
});
