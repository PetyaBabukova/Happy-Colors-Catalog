import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readJson } from '../_helpers.js';

const authUser = { _id: 'user-1' };
const save = vi.fn();
const fileRef = vi.fn(() => ({ save }));
const bucket = vi.fn(() => ({ file: fileRef }));
const getStorage = vi.fn(() => ({ bucket }));
const buildStorageObjectName = vi.fn((folder, fileName) => `${folder}/${fileName}`);
const createPublicUrl = vi.fn((bucketName, objectName) => `https://storage.googleapis.com/${bucketName}/${objectName}`);
const createUploadDeleteToken = vi.fn(() => 'delete-token');
let authResult;
let bucketName;

async function loadRoute() {
  return import('../../../src/app/api/uploads/proxy/route.js');
}

function buildWebpFile() {
  const webpBytes = new Uint8Array([
    0x52,
    0x49,
    0x46,
    0x46,
    0x04,
    0x00,
    0x00,
    0x00,
    0x57,
    0x45,
    0x42,
    0x50,
  ]);

  return new File([webpBytes], 'banner.webp', { type: 'image/webp' });
}

function createFormRequest({ kind = 'home-banner-image', file = buildWebpFile() } = {}) {
  const formData = new FormData();
  formData.append('kind', kind);
  formData.append('file', file);

  return {
    formData: async () => formData,
    headers: {
      get: () => null,
    },
    cookies: {
      get: () => undefined,
    },
  };
}

describe('/api/uploads/proxy', () => {
  beforeEach(() => {
    authResult = { ok: true, user: authUser };
    bucketName = 'test-bucket';
    save.mockResolvedValue(undefined);

    vi.doMock('../../../src/app/api/_lib/auth.js', () => ({
      requireApiAuth: vi.fn(() => authResult),
    }));
    vi.doMock('../../../src/app/api/_lib/gcs.js', () => ({
      buildStorageObjectName,
      createPublicUrl,
      getBucketName: vi.fn(() => bucketName),
      getStorage,
    }));
    vi.doMock('../../../src/app/api/_lib/uploadDeleteToken.js', () => ({
      createUploadDeleteToken,
    }));
  });

  it('uploads home banner images to the dedicated storage folder', async () => {
    const { POST } = await loadRoute();

    const response = await POST(createFormRequest());
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      publicUrl: 'https://storage.googleapis.com/test-bucket/home-banners/images/banner.webp',
      objectName: 'home-banners/images/banner.webp',
      deleteToken: 'delete-token',
      uploadMode: 'proxy',
    });
    expect(buildStorageObjectName).toHaveBeenCalledWith('home-banners/images', 'banner.webp', 'image/webp');
    expect(fileRef).toHaveBeenCalledWith('home-banners/images/banner.webp');
    expect(save).toHaveBeenCalledWith(expect.any(Buffer), {
      resumable: false,
      metadata: {
        contentType: 'image/webp',
      },
    });
  });

  it('rejects the old generic image upload kind', async () => {
    const { POST } = await loadRoute();

    const response = await POST(createFormRequest({ kind: 'image' }));

    expect(response.status).toBe(400);
  });
});
