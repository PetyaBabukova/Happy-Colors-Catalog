import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('gcsImageHelper cartoon signed read URLs', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.GCS_BUCKET_NAME;
    delete process.env.GCS_CARTOON_ORDERS_BUCKET_NAME;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    vi.doUnmock('@google-cloud/storage');
    vi.restoreAllMocks();
    delete process.env.GCS_BUCKET_NAME;
    delete process.env.GCS_CARTOON_ORDERS_BUCKET_NAME;
    delete process.env.NODE_ENV;
  });

  async function loadHelperWithStorageMock() {
    const getSignedUrl = vi.fn().mockResolvedValue(['https://signed.example.com/photo.webp']);
    const file = vi.fn(() => ({ getSignedUrl }));
    const bucket = vi.fn(() => ({ file }));
    const Storage = vi.fn(() => ({ bucket }));

    vi.doMock('@google-cloud/storage', () => ({ Storage }));

    const helper = await import('../../../helpers/gcsImageHelper.js');

    return {
      helper,
      bucket,
      file,
      getSignedUrl,
      Storage,
    };
  }

  it('creates signed read URLs from the private cartoon-orders bucket', async () => {
    process.env.NODE_ENV = 'production';
    process.env.GCS_CARTOON_ORDERS_BUCKET_NAME = 'happy-private-cartoon-orders';
    const { helper, bucket, file, getSignedUrl } = await loadHelperWithStorageMock();

    const signedUrl = await helper.createCartoonOrderPhotoSignedReadUrl({
      objectName: 'cartoon-orders/reference-photos/photo.webp',
      expiresInMs: 60_000,
    });

    expect(signedUrl).toBe('https://signed.example.com/photo.webp');
    expect(bucket).toHaveBeenCalledWith('happy-private-cartoon-orders');
    expect(file).toHaveBeenCalledWith('cartoon-orders/reference-photos/photo.webp');
    expect(getSignedUrl).toHaveBeenCalledWith({
      action: 'read',
      expires: expect.any(Number),
    });
  });

  it('rejects missing production cartoon bucket configuration before storage access', async () => {
    process.env.NODE_ENV = 'production';
    process.env.GCS_BUCKET_NAME = 'public-bucket';
    const { helper, bucket } = await loadHelperWithStorageMock();

    await expect(
      helper.createCartoonOrderPhotoSignedReadUrl({
        objectName: 'cartoon-orders/reference-photos/photo.webp',
      })
    ).rejects.toThrow('GCS_CARTOON_ORDERS_BUCKET_NAME is not configured.');
    expect(bucket).not.toHaveBeenCalled();
  });

  it('rejects unsafe cartoon object names before storage access', async () => {
    process.env.NODE_ENV = 'production';
    process.env.GCS_CARTOON_ORDERS_BUCKET_NAME = 'happy-private-cartoon-orders';
    const { helper, bucket } = await loadHelperWithStorageMock();

    await expect(
      helper.createCartoonOrderPhotoSignedReadUrl({
        objectName: 'cartoon-orders/reference-photos/../secret.webp',
      })
    ).rejects.toThrow('Invalid cartoon order photo object name.');
    expect(bucket).not.toHaveBeenCalled();
  });
});
