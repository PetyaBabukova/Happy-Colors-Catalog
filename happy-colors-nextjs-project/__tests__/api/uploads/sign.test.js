import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_VIDEO_UPLOAD_SIZE_BYTES } from '../../../src/config/productLimits.js';
import { createInvalidJsonRequest, createJsonRequest, readJson } from '../_helpers.js';

const authUser = { _id: 'user-1', role: 'artist', artistStatus: 'active' };
const generateSignedPostPolicyV4 = vi.fn();
const file = vi.fn(() => ({ generateSignedPostPolicyV4 }));
const bucket = vi.fn(() => ({ file }));
const getStorage = vi.fn(() => ({ bucket }));
const buildStorageObjectName = vi.fn((folder, fileName) => `${folder}/${fileName}`);
const createPublicUrl = vi.fn((bucketName, objectName) => `https://storage.googleapis.com/${bucketName}/${objectName}`);
const createUploadDeleteToken = vi.fn(() => 'delete-token');
let authResult;
let bucketName;

async function loadRoute() {
  return import('../../../src/app/api/uploads/sign/route.js');
}

describe('/api/uploads/sign', () => {
  beforeEach(() => {
    authResult = { ok: true, user: authUser };
    bucketName = 'test-bucket';
    generateSignedPostPolicyV4.mockResolvedValue([
      {
        url: 'https://storage.googleapis.com/test-bucket',
        fields: { key: 'products/videos/clip.mp4' },
      },
    ]);

    vi.doMock('../../../src/app/api/_lib/auth.js', () => ({
      requireApiAuth: vi.fn(() => authResult),
      requireApiActiveArtistOrFullAdmin: vi.fn((auth) =>
        auth.ok && auth.user?.role !== 'full_admin' && !(auth.user?.role === 'artist' && auth.user?.artistStatus === 'active')
          ? { ok: false, status: 403, message: 'Forbidden.' }
          : auth
      ),
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

  it('returns a signed policy for valid authenticated video uploads', async () => {
    const { POST } = await loadRoute();

    const response = await POST(
      createJsonRequest({
        kind: 'video',
        mimeType: 'video/mp4',
        fileName: 'clip.mp4',
        fileSize: 1024,
      })
    );
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      uploadUrl: 'https://storage.googleapis.com/test-bucket',
      formFields: { key: 'products/videos/clip.mp4' },
      publicUrl: 'https://storage.googleapis.com/test-bucket/products/videos/clip.mp4',
      objectName: 'products/videos/clip.mp4',
      deleteToken: 'delete-token',
    });
    expect(buildStorageObjectName).toHaveBeenCalledWith('products/videos', 'clip.mp4', 'video/mp4');
    expect(createUploadDeleteToken).toHaveBeenCalledWith({
      objectName: 'products/videos/clip.mp4',
      userId: 'user-1',
    });
  });

  it('returns a signed policy for valid authenticated poster uploads', async () => {
    const { POST } = await loadRoute();

    const response = await POST(
      createJsonRequest({
        kind: 'poster',
        mimeType: 'image/webp',
        fileName: 'poster.webp',
        fileSize: 1024,
      })
    );
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.objectName).toBe('products/posters/poster.webp');
    expect(body.publicUrl).toBe('https://storage.googleapis.com/test-bucket/products/posters/poster.webp');
    expect(buildStorageObjectName).toHaveBeenCalledWith('products/posters', 'poster.webp', 'image/webp');
    expect(file).toHaveBeenCalledWith('products/posters/poster.webp');
  });

  it('rejects unauthenticated requests', async () => {
    authResult = { ok: false, status: 401, message: 'Missing authentication token.' };
    const { POST } = await loadRoute();

    const response = await POST(createJsonRequest({}));

    expect(response.status).toBe(401);
  });

  it('rejects malformed JSON', async () => {
    const { POST } = await loadRoute();

    const response = await POST(createInvalidJsonRequest());

    expect(response.status).toBe(400);
  });

  it('rejects unsupported upload kinds', async () => {
    const { POST } = await loadRoute();

    await expect(POST(createJsonRequest({ kind: 'document' }))).resolves.toMatchObject({ status: 400 });
  });

  it('rejects unsupported MIME types', async () => {
    const { POST } = await loadRoute();

    await expect(
      POST(createJsonRequest({ kind: 'video', mimeType: 'image/png', fileName: 'clip.mp4', fileSize: 10 }))
    ).resolves.toMatchObject({ status: 400 });
  });

  it('rejects missing file names', async () => {
    const { POST } = await loadRoute();

    await expect(
      POST(createJsonRequest({ kind: 'video', mimeType: 'video/mp4', fileName: '', fileSize: 10 }))
    ).resolves.toMatchObject({ status: 400 });
  });

  it('rejects invalid and oversized file sizes', async () => {
    const { POST } = await loadRoute();

    await expect(
      POST(createJsonRequest({ kind: 'video', mimeType: 'video/mp4', fileName: 'clip.mp4', fileSize: 0 }))
    ).resolves.toMatchObject({ status: 400 });
    await expect(
      POST(
        createJsonRequest({
          kind: 'video',
          mimeType: 'video/mp4',
          fileName: 'clip.mp4',
          fileSize: MAX_VIDEO_UPLOAD_SIZE_BYTES + 1,
        })
      )
    ).resolves.toMatchObject({ status: 400 });
  });

  it('returns 500 when bucket config is missing', async () => {
    const { POST } = await loadRoute();

    bucketName = '';
    await expect(
      POST(createJsonRequest({ kind: 'video', mimeType: 'video/mp4', fileName: 'clip.mp4', fileSize: 10 }))
    ).resolves.toMatchObject({ status: 500 });
  });

  it('returns 500 when signed policy generation fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    generateSignedPostPolicyV4.mockRejectedValueOnce(new Error('gcs failed'));
    const { POST } = await loadRoute();

    await expect(
      POST(createJsonRequest({ kind: 'video', mimeType: 'video/mp4', fileName: 'clip.mp4', fileSize: 10 }))
    ).resolves.toMatchObject({ status: 500 });
  });
});
