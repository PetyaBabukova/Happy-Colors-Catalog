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

  it('rejects empty, malformed, traversal, and incomplete GCS URLs', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(extractObjectNameFromGcsUrl('')).toBeNull();
    expect(extractObjectNameFromGcsUrl('not-a-url')).toBeNull();
    expect(extractObjectNameFromGcsUrl('https://storage.googleapis.com/happy-bucket')).toBeNull();
    expect(
      extractObjectNameFromGcsUrl('https://storage.googleapis.com/happy-bucket/products/../secret.webp')
    ).toBeNull();
    expect(
      extractObjectNameFromGcsUrl('https://storage.googleapis.com/happy-bucket/products/./secret.webp')
    ).toBeNull();
    expect(
      extractObjectNameFromGcsUrl('https://storage.googleapis.com/happy-bucket/products/%2e%2e/secret.webp')
    ).toBeNull();
    expect(
      extractObjectNameFromGcsUrl('https://storage.googleapis.com/happy-bucket/products/%2E/secret.webp')
    ).toBeNull();
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
