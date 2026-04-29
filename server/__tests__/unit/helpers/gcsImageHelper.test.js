import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extractObjectNameFromGcsUrl, getBucketName } from '../../../helpers/gcsImageHelper.js';

describe('gcsImageHelper', () => {
  beforeEach(() => {
    process.env.GCS_BUCKET_NAME = 'happy-bucket';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.GCS_BUCKET_NAME;
  });

  it('reads the bucket name from environment', () => {
    expect(getBucketName()).toBe('happy-bucket');
  });

  it('extracts object names from valid GCS URLs', () => {
    expect(
      extractObjectNameFromGcsUrl(
        'https://storage.googleapis.com/happy-bucket/products/images/demo.webp'
      )
    ).toBe('products/images/demo.webp');
  });

  it('rejects URLs outside the configured bucket or host', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(
      extractObjectNameFromGcsUrl(
        'https://storage.googleapis.com/other-bucket/products/images/demo.webp'
      )
    ).toBeNull();
    expect(extractObjectNameFromGcsUrl('https://example.com/happy-bucket/demo.webp')).toBeNull();
  });

  it('returns null when no bucket is configured', () => {
    delete process.env.GCS_BUCKET_NAME;

    expect(
      extractObjectNameFromGcsUrl(
        'https://storage.googleapis.com/happy-bucket/products/images/demo.webp'
      )
    ).toBeNull();
  });
});
