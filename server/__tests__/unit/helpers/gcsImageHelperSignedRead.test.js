import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'path';
import { Readable } from 'node:stream';

describe('gcsImageHelper cartoon signed read URLs', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.GCS_BUCKET_NAME;
    delete process.env.GCS_CARTOON_ORDERS_BUCKET_NAME;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    vi.doUnmock('@google-cloud/storage');
    vi.doUnmock('fs');
    vi.restoreAllMocks();
    delete process.env.GCS_BUCKET_NAME;
    delete process.env.GCS_CARTOON_ORDERS_BUCKET_NAME;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.NODE_ENV;
  });

  async function loadHelperWithStorageMock({ existingCredentialPath = '', getFilesImpl = null } = {}) {
    const getSignedUrl = vi.fn().mockResolvedValue(['https://signed.example.com/photo.webp']);
    const deleteFile = vi.fn().mockResolvedValue(undefined);
    const exists = vi.fn().mockResolvedValue([true]);
    const createReadStream = vi.fn(() => Readable.from([Buffer.from('mock-photo')]));
    const file = vi.fn(() => ({ createReadStream, delete: deleteFile, exists, getSignedUrl }));
    const getFiles = vi.fn(getFilesImpl || (async () => [[], null]));
    const bucket = vi.fn(() => ({ file, getFiles }));
    const Storage = vi.fn(() => ({ bucket }));
    const existingCredentialPaths = Array.isArray(existingCredentialPath)
      ? existingCredentialPath
      : [existingCredentialPath].filter(Boolean);
    const existsSync = vi.fn((candidate) => existingCredentialPaths.includes(candidate));

    vi.doMock('@google-cloud/storage', () => ({ Storage }));
    vi.doMock('fs', () => ({
      default: { existsSync },
      existsSync,
    }));

    const helper = await import('../../../helpers/gcsImageHelper.js');

    return {
      helper,
      bucket,
      createReadStream,
      deleteFile,
      exists,
      file,
      getFiles,
      getSignedUrl,
      Storage,
      existsSync,
    };
  }

  it('creates signed read URLs from the private cartoon-orders bucket', async () => {
    process.env.NODE_ENV = 'production';
    process.env.GCS_CARTOON_ORDERS_BUCKET_NAME = 'happy-private-cartoon-orders';
    const { helper, bucket, file, getSignedUrl, Storage } = await loadHelperWithStorageMock();

    const signedUrl = await helper.createCartoonOrderPhotoSignedReadUrl({
      objectName: 'cartoon-orders/reference-photos/photo.webp',
      expiresInMs: 60_000,
    });

    expect(signedUrl).toBe('https://signed.example.com/photo.webp');
    expect(Storage).toHaveBeenCalledWith();
    expect(bucket).toHaveBeenCalledWith('happy-private-cartoon-orders');
    expect(file).toHaveBeenCalledWith('cartoon-orders/reference-photos/photo.webp');
    expect(getSignedUrl).toHaveBeenCalledWith({
      action: 'read',
      expires: expect.any(Number),
      version: 'v4',
    });
  });

  it('creates diagnostic signed read probes only for the reserved non-customer object', async () => {
    process.env.NODE_ENV = 'production';
    process.env.GCS_CARTOON_ORDERS_BUCKET_NAME = 'happy-private-cartoon-orders';
    const { helper, file, getSignedUrl } = await loadHelperWithStorageMock();

    await helper.createCartoonOrderPhotoDiagnosticSignedReadProbe({ expiresInMs: 1000 });

    expect(file).toHaveBeenCalledWith('diagnostics/sign-probe/non-customer-placeholder');
    expect(file).not.toHaveBeenCalledWith('cartoon-orders/reference-photos/photo.webp');
    expect(getSignedUrl).toHaveBeenCalledWith({
      action: 'read',
      expires: expect.any(Number),
      version: 'v4',
    });
  });

  it('returns safe storage context fields without raw bucket or credential paths', async () => {
    process.env.NODE_ENV = 'production';
    process.env.GCS_BUCKET_NAME = 'public-bucket';
    process.env.GCS_CARTOON_ORDERS_BUCKET_NAME = 'happy-private-cartoon-orders';
    const { helper } = await loadHelperWithStorageMock({
      existingCredentialPath: '/etc/secrets/gcp-service-account.json',
    });

    const context = helper.getSafeCartoonPhotoStorageContext();
    const serialized = JSON.stringify(context);

    expect(context).toEqual({
      runtimeSurface: 'express-admin',
      runtimeEnvClass: 'production',
      privateBucketConfigured: true,
      privateDiffersFromPublic: true,
      publicBucketFallbackActive: false,
      credentialSource: 'mounted_secret_file',
      credentialFileResolved: true,
      usingApplicationDefaultCredentials: false,
    });
    expect(serialized).not.toContain('happy-private-cartoon-orders');
    expect(serialized).not.toContain('/etc/secrets/gcp-service-account.json');
    expect(serialized).not.toContain('public-bucket');
  });

  it('uses the standard secret-file credential fallback when available', async () => {
    process.env.NODE_ENV = 'production';
    process.env.GCS_CARTOON_ORDERS_BUCKET_NAME = 'happy-private-cartoon-orders';
    const { helper, Storage, existsSync } = await loadHelperWithStorageMock({
      existingCredentialPath: '/etc/secrets/gcp-service-account.json',
    });

    await helper.createCartoonOrderPhotoSignedReadUrl({
      objectName: 'cartoon-orders/reference-photos/photo.webp',
    });

    expect(existsSync).toHaveBeenCalledWith('/etc/secrets/gcp-service-account.json');
    expect(Storage).toHaveBeenCalledWith({
      keyFilename: '/etc/secrets/gcp-service-account.json',
    });
  });

  it('uses the repository root credential fallback when available', async () => {
    process.env.NODE_ENV = 'production';
    process.env.GCS_CARTOON_ORDERS_BUCKET_NAME = 'happy-private-cartoon-orders';
    const repoRootKey = path.resolve(process.cwd(), '..', 'gcp-service-account.json');
    const { helper, Storage, existsSync } = await loadHelperWithStorageMock({
      existingCredentialPath: repoRootKey,
    });

    await helper.createCartoonOrderPhotoSignedReadUrl({
      objectName: 'cartoon-orders/reference-photos/photo.webp',
    });

    expect(existsSync).toHaveBeenCalledWith(expect.stringContaining('gcp-service-account.json'));
    expect(Storage).toHaveBeenCalledWith({
      keyFilename: expect.stringContaining('gcp-service-account.json'),
    });
  });

  it('prefers the explicit Google credentials path over fallback files', async () => {
    process.env.NODE_ENV = 'production';
    process.env.GCS_CARTOON_ORDERS_BUCKET_NAME = 'happy-private-cartoon-orders';
    process.env.GOOGLE_APPLICATION_CREDENTIALS = 'C:\\secrets\\explicit-gcp-key.json';
    const { helper, Storage } = await loadHelperWithStorageMock({
      existingCredentialPath: [
        'C:\\secrets\\explicit-gcp-key.json',
        '/etc/secrets/gcp-service-account.json',
      ],
    });

    await helper.createCartoonOrderPhotoSignedReadUrl({
      objectName: 'cartoon-orders/reference-photos/photo.webp',
    });

    expect(Storage).toHaveBeenCalledWith({
      keyFilename: 'C:\\secrets\\explicit-gcp-key.json',
    });
  });

  it('deletes cartoon order photos with the private cartoon credentials', async () => {
    process.env.NODE_ENV = 'production';
    process.env.GCS_CARTOON_ORDERS_BUCKET_NAME = 'happy-private-cartoon-orders';
    const { helper, bucket, deleteFile, file, Storage } = await loadHelperWithStorageMock({
      existingCredentialPath: '/etc/secrets/gcp-service-account.json',
    });

    await helper.deleteGcsObjectByName('cartoon-orders/reference-photos/photo.webp', {
      throwOnError: true,
    });

    expect(Storage).toHaveBeenCalledWith({
      keyFilename: '/etc/secrets/gcp-service-account.json',
    });
    expect(bucket).toHaveBeenCalledWith('happy-private-cartoon-orders');
    expect(file).toHaveBeenCalledWith('cartoon-orders/reference-photos/photo.webp');
    expect(deleteFile).toHaveBeenCalledWith({ ignoreNotFound: false });
  });

  it('checks cartoon order photo existence with safe enum statuses', async () => {
    process.env.NODE_ENV = 'production';
    process.env.GCS_CARTOON_ORDERS_BUCKET_NAME = 'happy-private-cartoon-orders';
    const { helper, exists } = await loadHelperWithStorageMock({
      existingCredentialPath: '/etc/secrets/gcp-service-account.json',
    });

    await expect(
      helper.checkCartoonOrderPhotoExists('cartoon-orders/reference-photos/photo.webp')
    ).resolves.toEqual({
      status: 'exists',
      errorCategory: '',
      code: '',
      name: '',
    });

    exists.mockResolvedValueOnce([false]);

    await expect(
      helper.checkCartoonOrderPhotoExists('cartoon-orders/reference-photos/missing.webp')
    ).resolves.toEqual({
      status: 'not_found',
      errorCategory: '',
      code: '',
      name: '',
    });
  });

  it('lists cartoon order photo objects across storage pages under the private prefix', async () => {
    process.env.NODE_ENV = 'production';
    process.env.GCS_CARTOON_ORDERS_BUCKET_NAME = 'happy-private-cartoon-orders';
    const { helper, getFiles } = await loadHelperWithStorageMock({
      getFilesImpl: vi.fn()
        .mockResolvedValueOnce([
          [
            {
              name: 'cartoon-orders/reference-photos/first.webp',
              metadata: { updated: '2026-06-17T10:00:00.000Z' },
            },
          ],
          { pageToken: 'page-2' },
        ])
        .mockResolvedValueOnce([
          [
            {
              name: 'cartoon-orders/reference-photos/second.webp',
              metadata: { timeCreated: '2026-06-17T11:00:00.000Z' },
            },
          ],
          null,
        ]),
    });

    const result = await helper.listCartoonOrderPhotoObjects({ limit: 2000 });

    expect(result).toEqual({
      ok: true,
      errorCategory: 'none',
      objects: [
        {
          objectName: 'cartoon-orders/reference-photos/first.webp',
          updatedAt: new Date('2026-06-17T10:00:00.000Z'),
        },
        {
          objectName: 'cartoon-orders/reference-photos/second.webp',
          updatedAt: new Date('2026-06-17T11:00:00.000Z'),
        },
      ],
    });
    expect(getFiles).toHaveBeenNthCalledWith(1, {
      autoPaginate: false,
      maxResults: 1000,
      pageToken: undefined,
      prefix: 'cartoon-orders/reference-photos/',
    });
    expect(getFiles).toHaveBeenNthCalledWith(2, {
      autoPaginate: false,
      maxResults: 1000,
      pageToken: 'page-2',
      prefix: 'cartoon-orders/reference-photos/',
    });
  });

  it('bounds cartoon order photo object listing by the total limit', async () => {
    process.env.NODE_ENV = 'production';
    process.env.GCS_CARTOON_ORDERS_BUCKET_NAME = 'happy-private-cartoon-orders';
    const { helper, getFiles } = await loadHelperWithStorageMock({
      getFilesImpl: vi.fn()
        .mockResolvedValueOnce([
          [
            {
              name: 'cartoon-orders/reference-photos/first.webp',
              metadata: { updated: '2026-06-17T10:00:00.000Z' },
            },
          ],
          { pageToken: 'page-2' },
        ])
        .mockResolvedValueOnce([
          [
            {
              name: 'cartoon-orders/reference-photos/second.webp',
              metadata: { updated: '2026-06-17T11:00:00.000Z' },
            },
          ],
          null,
        ]),
    });

    const result = await helper.listCartoonOrderPhotoObjects({ limit: 1 });

    expect(result.objects).toEqual([
      {
        objectName: 'cartoon-orders/reference-photos/first.webp',
        updatedAt: new Date('2026-06-17T10:00:00.000Z'),
      },
    ]);
    expect(getFiles).toHaveBeenCalledTimes(1);
    expect(getFiles).toHaveBeenCalledWith({
      autoPaginate: false,
      maxResults: 1,
      pageToken: undefined,
      prefix: 'cartoon-orders/reference-photos/',
    });
  });

  it('creates private cartoon photo read streams without signed URLs', async () => {
    process.env.NODE_ENV = 'production';
    process.env.GCS_CARTOON_ORDERS_BUCKET_NAME = 'happy-private-cartoon-orders';
    const { helper, createReadStream, file } = await loadHelperWithStorageMock({
      existingCredentialPath: '/etc/secrets/gcp-service-account.json',
    });

    const stream = helper.createCartoonOrderPhotoReadStream(
      'cartoon-orders/reference-photos/photo.webp'
    );

    expect(stream).toBeTruthy();
    expect(file).toHaveBeenCalledWith('cartoon-orders/reference-photos/photo.webp');
    expect(createReadStream).toHaveBeenCalledTimes(1);
  });

  it('treats missing cartoon order photo deletes as ambiguous when throwOnError is enabled', async () => {
    process.env.NODE_ENV = 'production';
    process.env.GCS_CARTOON_ORDERS_BUCKET_NAME = 'happy-private-cartoon-orders';
    const { helper, deleteFile } = await loadHelperWithStorageMock({
      existingCredentialPath: '/etc/secrets/gcp-service-account.json',
    });
    deleteFile.mockRejectedValueOnce(Object.assign(new Error('No such object'), { code: '404' }));

    await expect(
      helper.deleteGcsObjectByName('cartoon-orders/reference-photos/photo.webp', {
        throwOnError: true,
      })
    ).rejects.toThrow('No such object');
  });

  it('does not log raw provider errors from private cartoon photo deletes', async () => {
    process.env.NODE_ENV = 'production';
    process.env.GCS_CARTOON_ORDERS_BUCKET_NAME = 'happy-private-cartoon-orders';
    const { helper, deleteFile } = await loadHelperWithStorageMock({
      existingCredentialPath: '/etc/secrets/gcp-service-account.json',
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    deleteFile.mockRejectedValueOnce(
      Object.assign(new Error('provider message with private bucket detail'), { code: '500' })
    );

    await expect(
      helper.deleteGcsObjectByName('cartoon-orders/reference-photos/photo.webp', {
        throwOnError: true,
      })
    ).rejects.toThrow('provider message with private bucket detail');
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('logs only safe enum fields for non-throwing private cartoon photo delete failures', async () => {
    process.env.NODE_ENV = 'production';
    process.env.GCS_CARTOON_ORDERS_BUCKET_NAME = 'happy-private-cartoon-orders';
    const { helper, deleteFile } = await loadHelperWithStorageMock({
      existingCredentialPath: '/etc/secrets/gcp-service-account.json',
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    deleteFile.mockRejectedValueOnce(
      Object.assign(new Error('provider message with private bucket detail'), {
        code: '403',
        name: 'ApiError',
      })
    );

    await expect(
      helper.deleteGcsObjectByName('cartoon-orders/reference-photos/photo.webp')
    ).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith(
      'Cartoon order photo storage delete failed.',
      expect.objectContaining({
        operation: 'delete',
        runtimeSurface: 'express-admin',
        errorCategory: 'permission_denied',
        code: 'permission_denied',
        name: 'provider_api_error',
      })
    );
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('provider message with private bucket detail');
  });

  it('keeps generic storage on default credentials when cartoon photo credentials use a key file', async () => {
    process.env.NODE_ENV = 'production';
    process.env.GCS_CARTOON_ORDERS_BUCKET_NAME = 'happy-private-cartoon-orders';
    const { helper, Storage } = await loadHelperWithStorageMock({
      existingCredentialPath: '/etc/secrets/gcp-service-account.json',
    });

    await helper.createCartoonOrderPhotoSignedReadUrl({
      objectName: 'cartoon-orders/reference-photos/photo.webp',
    });
    helper.getStorage();

    expect(Storage).toHaveBeenNthCalledWith(1, {
      keyFilename: '/etc/secrets/gcp-service-account.json',
    });
    expect(Storage).toHaveBeenNthCalledWith(2);
  });

  it('rejects missing production cartoon bucket configuration before storage access', async () => {
    process.env.NODE_ENV = 'production';
    process.env.GCS_BUCKET_NAME = 'public-bucket';
    const { helper, bucket } = await loadHelperWithStorageMock();

    expect(helper.getCartoonOrdersBucketName()).toBe('');
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
