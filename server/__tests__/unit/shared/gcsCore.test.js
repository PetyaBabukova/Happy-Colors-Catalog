import { describe, expect, it, vi } from 'vitest';

import {
  createPublicUrl,
  extractObjectNameFromGcsUrl,
  isCartoonOrderPhotoObjectName,
  validateGcsPublicAssetUrl,
} from '../../../../shared/gcsCore.js';

describe('shared gcs core', () => {
  it('creates public Google storage URLs without touching runtime config', () => {
    expect(createPublicUrl('happy-bucket', 'products/images/demo.webp')).toBe(
      'https://storage.googleapis.com/happy-bucket/products/images/demo.webp'
    );
  });

  it('accepts only safe cartoon order photo object names', () => {
    expect(isCartoonOrderPhotoObjectName('cartoon-orders/reference-photos/photo.webp')).toBe(true);
    expect(isCartoonOrderPhotoObjectName('cartoon-orders/reference-photos/nested/photo.webp')).toBe(true);

    expect(isCartoonOrderPhotoObjectName('products/images/photo.webp')).toBe(false);
    expect(isCartoonOrderPhotoObjectName('cartoon-orders/reference-photos/..')).toBe(false);
    expect(isCartoonOrderPhotoObjectName('cartoon-orders/reference-photos/.')).toBe(false);
    expect(isCartoonOrderPhotoObjectName('cartoon-orders/reference-photos/a\\b.webp')).toBe(false);
    expect(isCartoonOrderPhotoObjectName('cartoon-orders/reference-photos')).toBe(false);
  });

  it('extracts object names from safe matching GCS URLs', () => {
    expect(
      extractObjectNameFromGcsUrl('https://storage.googleapis.com/happy-bucket/products/images/demo.webp', {
        bucketName: 'happy-bucket',
      })
    ).toBe('products/images/demo.webp');
  });

  it('rejects invalid, mismatched, and traversal GCS URLs', () => {
    const warn = vi.fn();
    const logError = vi.fn();

    expect(extractObjectNameFromGcsUrl('', { bucketName: 'happy-bucket' })).toBeNull();
    expect(extractObjectNameFromGcsUrl('not-a-url', { bucketName: 'happy-bucket', logError })).toBeNull();
    expect(
      extractObjectNameFromGcsUrl('https://storage.googleapis.com/other-bucket/products/images/demo.webp', {
        bucketName: 'happy-bucket',
        warn,
      })
    ).toBeNull();
    expect(
      extractObjectNameFromGcsUrl('https://storage.googleapis.com/happy-bucket/products/%2e%2e/secret.webp', {
        bucketName: 'happy-bucket',
      })
    ).toBeNull();

    expect(warn).toHaveBeenCalledOnce();
    expect(logError).toHaveBeenCalledOnce();
  });

  it('validates public asset URLs with bucket and prefix policy', () => {
    expect(
      validateGcsPublicAssetUrl({
        assetUrl: 'https://storage.googleapis.com/happy-bucket/blog/articles/hero/demo.webp',
        bucketName: 'happy-bucket',
        expectedPrefix: 'blog/articles/hero/',
        label: 'Hero image',
      })
    ).toEqual({
      ok: true,
      value: 'https://storage.googleapis.com/happy-bucket/blog/articles/hero/demo.webp',
      objectName: 'blog/articles/hero/demo.webp',
    });

    expect(
      validateGcsPublicAssetUrl({
        assetUrl: 'http://storage.googleapis.com/happy-bucket/blog/articles/hero/demo.webp',
        bucketName: 'happy-bucket',
      })
    ).toMatchObject({ ok: false, message: 'Image URL must be a safe storage URL.' });

    expect(
      validateGcsPublicAssetUrl({
        assetUrl: 'https://storage.googleapis.com/happy-bucket/blog/articles/thumbnails/demo.webp',
        bucketName: 'happy-bucket',
        expectedPrefix: 'blog/articles/hero/',
      })
    ).toMatchObject({ ok: false, message: 'Image URL must point to the expected storage path.' });

    expect(
      validateGcsPublicAssetUrl({
        assetUrl: 'https://storage.googleapis.com/happy-bucket/products/%2e%2e/secret.webp',
        bucketName: 'happy-bucket',
      })
    ).toMatchObject({ ok: false, message: 'Image URL must point to a valid storage object.' });
  });
});
