import { describe, expect, it } from 'vitest';
import {
  getPathLocale,
  isExternalHref,
  filterPublicSearchParams,
  localizeInternalHref,
  localizePath,
  localizePublicHref,
  negotiateLocale,
  parseAcceptLanguage,
  replacePathLocale,
  stripPathLocale,
  switchPublicLocaleHref,
} from '../../../src/i18n/routing';

describe('i18n routing helpers', () => {
  it('localizes root, query strings, hashes, and existing localized paths', () => {
    expect(localizePath('/', 'bg')).toBe('/bg');
    expect(localizePath('/products?category=candles#top', 'en')).toBe(
      '/en/products?category=candles#top'
    );
    expect(localizePath('/bg/products/product-1?q=abc', 'en')).toBe(
      '/en/products/product-1?q=abc'
    );
    expect(replacePathLocale('/en/blog/article-1#comments', 'bg')).toBe(
      '/bg/blog/article-1#comments'
    );
    expect(stripPathLocale('/en/products?category=candles')).toBe('/products?category=candles');
    expect(getPathLocale('/bg/products')).toBe('bg');
  });

  it('keeps external hrefs untouched while localizing internal hrefs', () => {
    expect(isExternalHref('https://example.com/products')).toBe(true);
    expect(isExternalHref('//example.com/products')).toBe(true);
    expect(isExternalHref('mailto:test@example.com')).toBe(true);
    expect(localizeInternalHref('https://example.com/products', 'en')).toBe(
      'https://example.com/products'
    );
    expect(localizeInternalHref('/contacts?productId=123', 'en')).toBe(
      '/en/contacts?productId=123'
    );
    expect(localizeInternalHref('contacts#form', 'bg')).toBe('/bg/contacts#form');
  });

  it('filters public query strings for language switching and redirects', () => {
    expect(
      filterPublicSearchParams('?q=candle&redirect=https://evil.test&productId=123&token=secret', {
        localeNotice: 'english-unavailable',
      })
    ).toBe('?q=candle&productId=123&localeNotice=english-unavailable');
    expect(
      filterPublicSearchParams(
        '?q=candle&token=secret',
        { localeNotice: 'english-unavailable' },
        { includeToken: true }
      )
    ).toBe('?q=candle&token=secret&localeNotice=english-unavailable');

    expect(
      localizePublicHref('/bg/products?category=candles&token=secret&next=https://evil.test#list', 'en')
    ).toBe('/en/products?category=candles#list');
    expect(
      switchPublicLocaleHref('/contacts?service=cartoons&productId=123&next=//evil.test', 'bg')
    ).toBe('/bg/contacts?service=cartoons&productId=123');
    expect(localizePublicHref('https://example.com/page?next=/products', 'en')).toBe(
      'https://example.com/page?next=/products'
    );
  });

  it('rejects unsupported locale path localization', () => {
    expect(() => localizePath('/products', 'fr')).toThrow(/Unsupported locale/);
  });

  it('parses Accept-Language q-values in preference order', () => {
    expect(parseAcceptLanguage('en-US,en;q=0.8,bg;q=0.9')).toEqual([
      { range: 'en-us', quality: 1, index: 0 },
      { range: 'bg', quality: 0.9, index: 2 },
      { range: 'en', quality: 0.8, index: 1 },
    ]);
  });

  it('negotiates only enabled public locales', () => {
    expect(
      negotiateLocale('en-US,en;q=0.8,bg;q=0.9', { enabledLocales: ['bg', 'en'] })
    ).toBe('en');
    expect(
      negotiateLocale('bg-BG,bg;q=0.8,en;q=0.7', { enabledLocales: ['bg', 'en'] })
    ).toBe('bg');
    expect(negotiateLocale('en-US,en;q=0.8', { enabledLocales: ['bg'] })).toBe('bg');
    expect(negotiateLocale('de-DE,de;q=0.8', { enabledLocales: ['bg', 'en'] })).toBe('bg');
    expect(negotiateLocale('*', { enabledLocales: ['bg', 'en'] })).toBe('bg');
    expect(negotiateLocale('*', { enabledLocales: ['en'] })).toBe('en');
    expect(negotiateLocale('', { enabledLocales: ['bg', 'en'] })).toBe('bg');
    expect(negotiateLocale(';;;;', { enabledLocales: ['bg', 'en'] })).toBe('bg');
  });
});
