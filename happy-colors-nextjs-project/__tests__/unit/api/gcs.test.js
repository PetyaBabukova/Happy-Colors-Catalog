import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { Storage } = vi.hoisted(() => ({
  Storage: vi.fn(),
}));

vi.mock('@google-cloud/storage', () => ({
  Storage,
}));

async function loadGcs() {
  return import('../../../src/app/api/_lib/gcs.js');
}

describe('api gcs helper', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('GCS_BUCKET_NAME', 'happy-bucket');
    Storage.mockClear();
    Storage.mockImplementation((options = {}) => ({ options }));
    vi.doMock('../../../src/app/api/_lib/env.js', () => ({
      ensureServerEnvLoaded: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('returns bucket names and public storage URLs', async () => {
    const { createPublicUrl, getBucketName } = await loadGcs();

    expect(getBucketName()).toBe('happy-bucket');
    expect(createPublicUrl('happy-bucket', 'products/images/a.webp')).toBe(
      'https://storage.googleapis.com/happy-bucket/products/images/a.webp'
    );
  });

  it('uses the private cartoon orders bucket before development/test fallback', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('GCS_CARTOON_ORDERS_BUCKET_NAME', 'happy-private-cartoon-orders');
    const { getCartoonOrdersBucketName } = await loadGcs();

    expect(getCartoonOrdersBucketName()).toBe('happy-private-cartoon-orders');
  });

  it('does not fall back to the public bucket for cartoon orders in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('GCS_CARTOON_ORDERS_BUCKET_NAME', '');
    const { getCartoonOrdersBucketName } = await loadGcs();

    expect(getCartoonOrdersBucketName()).toBe('');
  });

  it('allows the public bucket fallback for cartoon orders in test', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('GCS_CARTOON_ORDERS_BUCKET_NAME', '');
    const { getCartoonOrdersBucketName } = await loadGcs();

    expect(getCartoonOrdersBucketName()).toBe('happy-bucket');
  });

  it('rejects unsafe cartoon order photo object names', async () => {
    const { isCartoonOrderPhotoObjectName } = await loadGcs();

    expect(isCartoonOrderPhotoObjectName('cartoon-orders/reference-photos/photo.webp')).toBe(true);
    expect(isCartoonOrderPhotoObjectName('cartoon-orders/reference-photos/..')).toBe(false);
    expect(isCartoonOrderPhotoObjectName('cartoon-orders/reference-photos/a\\b.webp')).toBe(false);
  });

  it('resolves upload extensions from file names before MIME defaults', async () => {
    const { resolveUploadExtension } = await loadGcs();

    expect(resolveUploadExtension('photo.JPEG', 'image/png')).toBe('.jpeg');
    expect(resolveUploadExtension('', 'image/webp')).toBe('.webp');
    expect(resolveUploadExtension('', 'application/octet-stream')).toBe('');
  });

  it('builds storage object names with a generated id and safe extension', async () => {
    vi.doMock('crypto', async (importOriginal) => ({
      ...(await importOriginal()),
      randomUUID: vi.fn(() => 'uuid-1'),
    }));
    const { buildStorageObjectName } = await loadGcs();

    expect(buildStorageObjectName('products/videos', 'clip.mp4', 'video/mp4')).toBe('products/videos/uuid-1.mp4');
  });

  it('creates a default storage client when no credentials file exists', async () => {
    vi.doMock('fs', async (importOriginal) => ({
      ...(await importOriginal()),
      default: {
        ...(await importOriginal()).default,
        existsSync: vi.fn(() => false),
      },
    }));
    const { getStorage } = await loadGcs();

    expect(getStorage()).toEqual({ options: {} });
    expect(getStorage()).toEqual({ options: {} });
    expect(Storage).toHaveBeenCalledTimes(1);
    expect(Storage).toHaveBeenCalledWith();
  });

  it('uses GOOGLE_APPLICATION_CREDENTIALS when it points to an existing file', async () => {
    vi.stubEnv('GOOGLE_APPLICATION_CREDENTIALS', 'C:/secrets/gcp.json');
    vi.doMock('fs', async (importOriginal) => ({
      ...(await importOriginal()),
      default: {
        ...(await importOriginal()).default,
        existsSync: vi.fn((candidate) => candidate === 'C:/secrets/gcp.json'),
      },
    }));
    const { getKeyFilename, getStorage } = await loadGcs();

    expect(getKeyFilename()).toBe('C:/secrets/gcp.json');
    expect(getStorage()).toEqual({ options: { keyFilename: 'C:/secrets/gcp.json' } });
    expect(Storage).toHaveBeenCalledWith({ keyFilename: 'C:/secrets/gcp.json' });
  });
});
