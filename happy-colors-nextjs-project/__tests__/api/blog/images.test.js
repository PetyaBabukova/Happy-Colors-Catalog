import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readJson } from '../_helpers.js';

const authUser = { _id: 'user-1' };
const save = vi.fn();
const deleteFile = vi.fn();
const fileRef = vi.fn(() => ({ save, delete: deleteFile }));
const bucket = vi.fn(() => ({ file: fileRef }));
const getStorage = vi.fn(() => ({ bucket }));
const buildStorageObjectName = vi.fn((folder, fileName) => `${folder}/${fileName}`);
const createPublicUrl = vi.fn((bucketName, objectName) => `https://storage.googleapis.com/${bucketName}/${objectName}`);
const createUploadDeleteToken = vi.fn(({ objectName }) => `delete-token:${objectName}`);
let authResult;
let bucketName;

async function loadRoute() {
  return import('../../../src/app/api/blog/images/route.js');
}

function buildImageFile({ name = 'article.png' } = {}) {
  const buffer = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  ]);

  return new File([buffer], name, { type: 'image/png' });
}

function createFormRequest({ file, kind = 'hero' } = {}) {
  const formData = new FormData();

  if (kind) {
    formData.append('kind', kind);
  }

  if (file) {
    formData.append('file', file);
  }

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

describe('/api/blog/images', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    authResult = { ok: true, user: authUser };
    bucketName = 'test-bucket';
    save.mockResolvedValue(undefined);
    deleteFile.mockResolvedValue(undefined);

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

    const route = await loadRoute();
    route.resetBlogImageUploadRateLimit();
  });

  it('rejects unauthenticated requests', async () => {
    authResult = { ok: false, status: 401, message: 'Missing authentication token.' };
    const { POST } = await loadRoute();

    await expect(POST(createFormRequest({ file: buildImageFile() }))).resolves.toMatchObject({
      status: 401,
    });
  });

  it('rejects missing, non-image, spoofed, and oversized files', async () => {
    const { POST } = await loadRoute();

    await expect(POST(createFormRequest())).resolves.toMatchObject({ status: 400 });

    await expect(
      POST(createFormRequest({ file: new File(['hello'], 'article.txt', { type: 'text/plain' }) }))
    ).resolves.toMatchObject({ status: 400 });

    await expect(
      POST(createFormRequest({ file: new File(['not an image'], 'article.png', { type: 'image/png' }) }))
    ).resolves.toMatchObject({ status: 400 });

    await expect(
      POST(
        createFormRequest({
          file: new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'article.png', {
            type: 'image/png',
          }),
        })
      )
    ).resolves.toMatchObject({ status: 400 });
  });

  it('uploads a manually selected hero image without generating a thumbnail', async () => {
    const { POST } = await loadRoute();

    const response = await POST(createFormRequest({ file: buildImageFile(), kind: 'hero' }));
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      kind: 'hero',
      imageUrl: 'https://storage.googleapis.com/test-bucket/blog/articles/hero/article.png',
      objectName: 'blog/articles/hero/article.png',
      deleteToken: 'delete-token:blog/articles/hero/article.png',
    });
    expect(buildStorageObjectName).toHaveBeenCalledWith('blog/articles/hero', 'article.png', 'image/png');
    expect(save).toHaveBeenCalledWith(expect.any(Buffer), {
      resumable: false,
      metadata: { contentType: 'image/png' },
    });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('uploads a manually selected thumbnail image to the thumbnail folder', async () => {
    const { POST } = await loadRoute();

    const response = await POST(createFormRequest({ file: buildImageFile({ name: 'article-thumb.png' }), kind: 'thumbnail' }));
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      kind: 'thumbnail',
      imageUrl: 'https://storage.googleapis.com/test-bucket/blog/articles/thumbnails/article-thumb.png',
      objectName: 'blog/articles/thumbnails/article-thumb.png',
      deleteToken: 'delete-token:blog/articles/thumbnails/article-thumb.png',
    });
    expect(buildStorageObjectName).toHaveBeenCalledWith(
      'blog/articles/thumbnails',
      'article-thumb.png',
      'image/png'
    );
  });

  it('rejects unsupported image upload kinds', async () => {
    const { POST } = await loadRoute();

    const response = await POST(createFormRequest({ file: buildImageFile(), kind: 'banner' }));

    expect(response.status).toBe(400);
    expect(save).not.toHaveBeenCalled();
  });

  it('cleans up uploaded blog image if response token creation fails after upload', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    save.mockReset();
    save.mockResolvedValueOnce(undefined);
    createUploadDeleteToken.mockImplementationOnce(() => {
      throw new Error('token failed');
    });
    const { POST } = await loadRoute();

    const response = await POST(createFormRequest({ file: buildImageFile() }));

    expect(response.status).toBe(500);
    expect(deleteFile).toHaveBeenCalledWith({ ignoreNotFound: true });
    expect(fileRef).toHaveBeenCalledWith('blog/articles/hero/article.png');
  });

  it('rate limits repeated authenticated upload requests', async () => {
    const { POST, resetBlogImageUploadRateLimit } = await loadRoute();
    resetBlogImageUploadRateLimit();
    const uploadFile = buildImageFile();

    for (let index = 0; index < 40; index += 1) {
      await expect(POST(createFormRequest({ file: uploadFile }))).resolves.toMatchObject({
        status: 200,
      });
    }

    const rateLimitedResponse = await POST(createFormRequest({ file: uploadFile }));

    expect(rateLimitedResponse.status).toBe(429);
    expect(rateLimitedResponse.headers.get('Retry-After')).toBeTruthy();
  });
});
