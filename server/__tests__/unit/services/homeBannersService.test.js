import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  validateHomeBannerImageUrl,
  validateInternalCtaHref,
  validateOptionalHomeBannerImageUrl,
} from '../../../services/homeBannersService.js';

describe('homeBannersService validation', () => {
  beforeEach(() => {
    process.env.GCS_BUCKET_NAME = 'test-bucket';
  });

  afterEach(() => {
    delete process.env.GCS_BUCKET_NAME;
  });

  it('accepts internal CTA paths including Cyrillic query strings', () => {
    expect(validateInternalCtaHref('/search?q=животинки')).toBe('/search?q=животинки');
    expect(validateInternalCtaHref(' /products ')).toBe('/products');
  });

  it('rejects external and unsafe CTA hrefs', () => {
    expect(() => validateInternalCtaHref('https://example.com')).toThrow(/internal path/i);
    expect(() => validateInternalCtaHref('//example.com')).toThrow(/internal path/i);
    expect(() => validateInternalCtaHref('/\\example.com')).toThrow(/internal path/i);
    expect(() => validateInternalCtaHref('javascript:alert(1)')).toThrow(/internal path/i);
    expect(() => validateInternalCtaHref('data:text/html,test')).toThrow(/internal path/i);
  });

  it('accepts image URLs from the configured GCS bucket', () => {
    expect(
      validateHomeBannerImageUrl(
        'https://storage.googleapis.com/test-bucket/home-banners/animals.webp'
      )
    ).toBe('https://storage.googleapis.com/test-bucket/home-banners/animals.webp');
  });

  it('accepts empty and valid optional mobile image URLs', () => {
    expect(validateOptionalHomeBannerImageUrl('')).toBe('');
    expect(validateOptionalHomeBannerImageUrl(null)).toBe('');
    expect(
      validateOptionalHomeBannerImageUrl(
        ' https://storage.googleapis.com/test-bucket/home-banners/mobile/animals.webp '
      )
    ).toBe('https://storage.googleapis.com/test-bucket/home-banners/mobile/animals.webp');
  });

  it('rejects image URLs from the wrong bucket or host', () => {
    expect(() =>
      validateHomeBannerImageUrl(
        'https://storage.googleapis.com/other-bucket/home-banners/animals.webp'
      )
    ).toThrow(/configured storage bucket/i);
    expect(() => validateHomeBannerImageUrl('https://example.com/animals.webp')).toThrow(
      /Google Cloud Storage/i
    );
  });

  it('rejects unsafe image URL schemes even when no bucket is configured', () => {
    delete process.env.GCS_BUCKET_NAME;

    expect(() => validateHomeBannerImageUrl('javascript:alert(1)')).toThrow(/safe storage URL/i);
    expect(() => validateHomeBannerImageUrl('data:text/html,test')).toThrow(/safe storage URL/i);
    expect(() => validateHomeBannerImageUrl('file:///tmp/banner.webp')).toThrow(/safe storage URL/i);
    expect(() => validateOptionalHomeBannerImageUrl('javascript:alert(1)')).toThrow(
      /safe storage URL/i
    );
    expect(() =>
      validateHomeBannerImageUrl(
        'https://storage.googleapis.com/test-bucket/home-banners/animals.webp'
      )
    ).toThrow(/bucket is not configured/i);
  });

  it('rejects malformed and traversal storage URLs', () => {
    expect(() => validateHomeBannerImageUrl('not-a-url')).toThrow(/invalid/i);
    expect(() =>
      validateHomeBannerImageUrl(
        'https://storage.googleapis.com/test-bucket/home-banners/%2e%2e/secret.webp'
      )
    ).toThrow(/valid storage object/i);
  });
});
