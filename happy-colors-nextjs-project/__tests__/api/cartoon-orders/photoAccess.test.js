import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { Storage } = vi.hoisted(() => ({
  Storage: vi.fn(),
}));

vi.mock('@google-cloud/storage', () => ({
  Storage,
}));

const getSignedUrl = vi.fn();
const file = vi.fn(() => ({ getSignedUrl }));
const bucket = vi.fn(() => ({ file }));

async function loadGcs() {
  return import('../../../src/app/api/_lib/gcs.js');
}

describe('cartoon order photo access helper', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('GCS_CARTOON_ORDERS_BUCKET_NAME', 'private-cartoon-bucket');
    Storage.mockClear();
    Storage.mockImplementation(() => ({ bucket }));
    getSignedUrl.mockResolvedValue(['https://signed.example/photo']);
    vi.doMock('../../../src/app/api/_lib/env.js', () => ({
      ensureServerEnvLoaded: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('generates signed read URLs only for cartoon order photo objects', async () => {
    const { createCartoonOrderPhotoSignedReadUrl } = await loadGcs();

    await expect(
      createCartoonOrderPhotoSignedReadUrl({
        objectName: 'cartoon-orders/reference-photos/photo.webp',
      })
    ).resolves.toBe('https://signed.example/photo');
    expect(bucket).toHaveBeenCalledWith('private-cartoon-bucket');
    expect(file).toHaveBeenCalledWith('cartoon-orders/reference-photos/photo.webp');
    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'read',
        expires: expect.any(Number),
      })
    );
  });

  it('rejects product, banner, traversal, and missing-bucket photo read attempts', async () => {
    const { createCartoonOrderPhotoSignedReadUrl } = await loadGcs();

    await expect(
      createCartoonOrderPhotoSignedReadUrl({ objectName: 'products/posters/photo.webp' })
    ).rejects.toThrow('Invalid cartoon order photo object name.');
    await expect(
      createCartoonOrderPhotoSignedReadUrl({ objectName: 'home-banners/images/photo.webp' })
    ).rejects.toThrow('Invalid cartoon order photo object name.');
    await expect(
      createCartoonOrderPhotoSignedReadUrl({
        objectName: 'cartoon-orders/reference-photos/../photo.webp',
      })
    ).rejects.toThrow('Invalid cartoon order photo object name.');

    vi.stubEnv('GCS_CARTOON_ORDERS_BUCKET_NAME', '');
    await expect(
      createCartoonOrderPhotoSignedReadUrl({
        objectName: 'cartoon-orders/reference-photos/photo.webp',
      })
    ).rejects.toThrow('GCS_CARTOON_ORDERS_BUCKET_NAME is not configured.');
  });
});
