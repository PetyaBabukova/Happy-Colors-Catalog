import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteGcsObjectByName,
  extractObjectNameFromGcsUrl,
  getCartoonOrdersBucketName,
  getBucketName,
} from '../../../helpers/gcsImageHelper.js';

describe('gcsImageHelper', () => {
  beforeEach(() => {
    process.env.GCS_BUCKET_NAME = 'happy-bucket';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.GCS_BUCKET_NAME;
    delete process.env.GCS_CARTOON_ORDERS_BUCKET_NAME;
    delete process.env.NODE_ENV;
  });

  it('reads the bucket name from environment', () => {
    expect(getBucketName()).toBe('happy-bucket');
  });

  it('uses a private cartoon-orders bucket when configured', () => {
    process.env.GCS_CARTOON_ORDERS_BUCKET_NAME = 'happy-private-cartoon-orders';

    expect(getCartoonOrdersBucketName()).toBe('happy-private-cartoon-orders');
  });

  it('does not fall back to the public bucket for cartoon orders in production', () => {
    process.env.NODE_ENV = 'production';

    expect(getCartoonOrdersBucketName()).toBe('');
  });

  it('allows public-bucket cartoon fallback outside production for local tests', () => {
    process.env.NODE_ENV = 'test';

    expect(getCartoonOrdersBucketName()).toBe('happy-bucket');
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

  it('rejects unsafe object-name deletes before reaching storage configuration', async () => {
    delete process.env.GCS_BUCKET_NAME;

    await expect(deleteGcsObjectByName('products/images/demo.webp')).rejects.toThrow(
      'Invalid cartoon order photo object name.'
    );
    await expect(
      deleteGcsObjectByName('cartoon-orders/reference-photos/../secret.webp')
    ).rejects.toThrow('Invalid cartoon order photo object name.');
    await expect(
      deleteGcsObjectByName('cartoon-orders/reference-photos/folder\\secret.webp')
    ).rejects.toThrow('Invalid cartoon order photo object name.');
  });
});
