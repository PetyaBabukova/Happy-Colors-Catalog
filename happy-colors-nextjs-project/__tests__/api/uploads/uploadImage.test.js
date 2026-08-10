import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readJson } from '../_helpers.js';

const authUser = { _id: 'user-1', role: 'artist', artistStatus: 'active' };
const save = vi.fn();
const fileRef = vi.fn(() => ({ save }));
const bucket = vi.fn(() => ({ file: fileRef }));
const getStorage = vi.fn(() => ({ bucket }));
const buildStorageObjectName = vi.fn(() => 'products/image.webp');
const createPublicUrl = vi.fn(() => 'https://storage.googleapis.com/test-bucket/products/image.webp');
const validateImageUploadFile = vi.fn(() => ({ ok: true, mimeType: 'image/webp' }));
let authResult;
let uploadAuthResult;
let bucketName;

function createFormRequest(file) {
  return {
    formData: async () => ({
      get: (key) => (key === 'file' ? file : null),
    }),
  };
}

function createFile({
  name = 'image.webp',
  type = 'image/webp',
  bytes = [1, 2, 3, 4],
} = {}) {
  return {
    name,
    type,
    size: bytes.length,
    arrayBuffer: async () => Uint8Array.from(bytes).buffer,
  };
}

async function loadRoute() {
  return import('../../../src/app/api/upload-image/route.js');
}

describe('/api/upload-image', () => {
  beforeEach(() => {
    authResult = { ok: true, user: authUser };
    uploadAuthResult = { ok: true, user: authUser };
    bucketName = 'test-bucket';
    save.mockResolvedValue(undefined);
    buildStorageObjectName.mockClear();
    createPublicUrl.mockClear();
    validateImageUploadFile.mockClear();
    fileRef.mockClear();
    bucket.mockClear();
    getStorage.mockClear();

    vi.doMock('../../../src/app/api/_lib/auth.js', () => ({
      requireApiAuth: vi.fn(() => authResult),
      requireApiActiveArtistOrFullAdmin: vi.fn(() => uploadAuthResult),
    }));
    vi.doMock('../../../src/app/api/_lib/gcs.js', () => ({
      buildStorageObjectName,
      createPublicUrl,
      getBucketName: vi.fn(() => bucketName),
      getStorage,
    }));
    vi.doMock('../../../src/app/api/_lib/uploadValidation.js', () => ({
      validateImageUploadFile,
    }));
  });

  it('uploads valid product images for active artists or full admins', async () => {
    const { POST } = await loadRoute();

    const response = await POST(createFormRequest(createFile()));
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body).toEqual({
      imageUrl: 'https://storage.googleapis.com/test-bucket/products/image.webp',
    });
    expect(validateImageUploadFile).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'image.webp', type: 'image/webp', size: 4 }),
      Buffer.from([1, 2, 3, 4])
    );
    expect(buildStorageObjectName).toHaveBeenCalledWith('products', 'image.webp', 'image/webp');
    expect(bucket).toHaveBeenCalledWith('test-bucket');
    expect(fileRef).toHaveBeenCalledWith('products/image.webp');
    expect(save).toHaveBeenCalledWith(Buffer.from([1, 2, 3, 4]), {
      resumable: false,
      metadata: {
        contentType: 'image/webp',
      },
    });
    expect(createPublicUrl).toHaveBeenCalledWith('test-bucket', 'products/image.webp');
  });

  it('rejects unauthenticated requests before reading form data', async () => {
    authResult = { ok: false, status: 401, message: 'Missing authentication token.' };
    const { POST } = await loadRoute();

    const response = await POST(createFormRequest(createFile()));

    expect(response.status).toBe(401);
    await expect(readJson(response)).resolves.toEqual({ message: 'Missing authentication token.' });
    expect(validateImageUploadFile).not.toHaveBeenCalled();
  });

  it('rejects authenticated users without upload permission', async () => {
    uploadAuthResult = { ok: false, status: 403, message: 'Forbidden.' };
    const { POST } = await loadRoute();

    const response = await POST(createFormRequest(createFile()));

    expect(response.status).toBe(403);
    await expect(readJson(response)).resolves.toEqual({ message: 'Forbidden.' });
    expect(validateImageUploadFile).not.toHaveBeenCalled();
  });

  it('returns configuration errors when the bucket is missing', async () => {
    bucketName = '';
    const { POST } = await loadRoute();

    const response = await POST(createFormRequest(createFile()));

    expect(response.status).toBe(500);
    expect(validateImageUploadFile).not.toHaveBeenCalled();
  });

  it('rejects missing or string form file values', async () => {
    const { POST } = await loadRoute();

    await expect(POST(createFormRequest(null))).resolves.toMatchObject({ status: 400 });
    await expect(POST(createFormRequest('not-a-file'))).resolves.toMatchObject({ status: 400 });
    expect(validateImageUploadFile).not.toHaveBeenCalled();
  });

  it('rejects invalid image uploads without touching storage', async () => {
    validateImageUploadFile.mockReturnValueOnce({
      ok: false,
      status: 415,
      message: 'Unsupported image type.',
    });
    const { POST } = await loadRoute();

    const response = await POST(createFormRequest(createFile()));

    expect(response.status).toBe(415);
    await expect(readJson(response)).resolves.toEqual({ message: 'Unsupported image type.' });
    expect(save).not.toHaveBeenCalled();
  });

  it('returns a generic server error when storage upload fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    save.mockRejectedValueOnce(new Error('gcs failed'));
    const { POST } = await loadRoute();

    const response = await POST(createFormRequest(createFile()));

    expect(response.status).toBe(500);
    await expect(readJson(response)).resolves.toEqual({
      message: 'Грешка при качване на изображението.',
    });
  });
});
