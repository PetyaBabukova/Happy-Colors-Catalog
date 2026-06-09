import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readJson } from '../_helpers.js';
import {
  CARTOON_ORDER_UPLOAD_CONFIRMATION_PURPOSE,
  createUploadSessionToken,
  verifyCartoonOrderUploadToken,
} from '../../../src/app/api/_lib/cartoonOrderUploadToken.js';

const appendCartoonUploadedObject = vi.fn();
const save = vi.fn();
const deleteFile = vi.fn();
const fileRef = vi.fn(() => ({ save, delete: deleteFile }));
const bucket = vi.fn(() => ({ file: fileRef }));
const getStorage = vi.fn(() => ({ bucket }));
const buildStorageObjectName = vi.fn(() => 'cartoon-orders/reference-photos/photo.webp');
let bucketName;

function webpFile({ name = 'photo.webp', type = 'image/webp', sizePadding = 0 } = {}) {
  const header = [
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
  ];
  const padding = new Uint8Array(sizePadding);

  return new File([new Uint8Array(header), padding], name, { type });
}

function pngFile({ name = 'photo.png', type = 'image/png', sizePadding = 0 } = {}) {
  const header = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const padding = new Uint8Array(sizePadding);

  return new File([new Uint8Array(header), padding], name, { type });
}

function createFormRequest({
  token,
  file = webpFile(),
  includeFile = true,
  origin = 'https://happycolors.test',
  host = 'happycolors.test',
  contentLength,
} = {}) {
  const formData = new FormData();

  if (token !== undefined) {
    formData.append('uploadSessionToken', token);
  }
  if (includeFile) {
    formData.append('file', file);
  }

  const headers = new Map([
    ['origin', origin],
    ['host', host],
    ['x-forwarded-proto', 'https'],
    ['x-forwarded-for', '203.0.113.11'],
  ]);

  if (contentLength !== undefined) {
    headers.set('content-length', String(contentLength));
  }

  return {
    formData: async () => formData,
    headers: {
      get: (name) => headers.get(String(name).toLowerCase()) || null,
    },
  };
}

async function loadRoute() {
  return import('../../../src/app/api/cartoon-orders/uploads/route.js');
}

describe('/api/cartoon-orders/uploads', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('CARTOON_ORDER_UPLOAD_TOKEN_SECRET', 'test-cartoon-upload-secret');
    vi.stubEnv('NEXT_PUBLIC_CARTOONS_SERVICE_ENABLED', 'true');
    bucketName = 'private-cartoon-bucket';
    save.mockResolvedValue(undefined);
    deleteFile.mockResolvedValue(undefined);
    appendCartoonUploadedObject.mockResolvedValue({
      ok: true,
      uploadedObject: {
        objectName: 'cartoon-orders/reference-photos/photo.webp',
      },
    });

    vi.doMock('../../../src/app/api/_lib/gcs.js', () => ({
      buildStorageObjectName,
      getCartoonOrdersBucketName: vi.fn(() => bucketName),
      getStorage,
    }));
    vi.doMock('../../../src/app/api/_lib/cartoonUploadSessionStore.js', () => ({
      appendCartoonUploadedObject,
    }));
  });

  it('requires a valid upload session token', async () => {
    const { POST } = await loadRoute();

    const response = await POST(createFormRequest({ token: '' }));

    expect(response.status).toBe(401);
    expect(save).not.toHaveBeenCalled();
  });

  it('does not expose uploads while the cartoons service gate is disabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_CARTOONS_SERVICE_ENABLED', 'false');
    const token = createUploadSessionToken({ sessionId: 'session-1' });
    const request = createFormRequest({ token });
    request.formData = vi.fn(request.formData);
    const { POST } = await loadRoute();

    const response = await POST(request);

    expect(response.status).toBe(404);
    expect(request.formData).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('returns 500 when the private cartoon order bucket is not configured', async () => {
    bucketName = '';
    const token = createUploadSessionToken({ sessionId: 'session-1' });
    const { POST } = await loadRoute();

    const response = await POST(createFormRequest({ token }));

    expect(response.status).toBe(500);
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects expired and wrong-purpose upload tokens', async () => {
    const { createUploadConfirmationToken } = await import(
      '../../../src/app/api/_lib/cartoonOrderUploadToken.js'
    );
    const expiredToken = createUploadSessionToken({
      sessionId: 'session-1',
      expiresAt: Date.now() - 1000,
    });
    const wrongPurposeToken = createUploadConfirmationToken({
      sessionId: 'session-1',
      objectName: 'cartoon-orders/reference-photos/photo.webp',
      contentType: 'image/webp',
      size: 12,
    });
    const { POST } = await loadRoute();

    await expect(POST(createFormRequest({ token: expiredToken }))).resolves.toMatchObject({
      status: 401,
    });
    await expect(POST(createFormRequest({ token: wrongPurposeToken }))).resolves.toMatchObject({
      status: 401,
    });
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects cross-origin upload requests', async () => {
    const token = createUploadSessionToken({ sessionId: 'session-1' });
    const { POST } = await loadRoute();

    const response = await POST(createFormRequest({ token, origin: 'https://evil.test' }));

    expect(response.status).toBe(403);
    expect(save).not.toHaveBeenCalled();
  });

  it('does not trust the request Host as an allowed production upload origin', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://happycolors.test');
    const token = createUploadSessionToken({ sessionId: 'session-1' });
    const { POST } = await loadRoute();

    const response = await POST(
      createFormRequest({
        token,
        origin: 'https://evil.test',
        host: 'evil.test',
        contentLength: 1024,
      })
    );

    expect(response.status).toBe(403);
    expect(save).not.toHaveBeenCalled();
  });

  it('requires content-length for production uploads before parsing multipart bodies', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://happycolors.test');
    const token = createUploadSessionToken({ sessionId: 'session-1' });
    const request = createFormRequest({ token });
    request.formData = vi.fn(request.formData);
    const { POST } = await loadRoute();

    const response = await POST(request);

    expect(response.status).toBe(411);
    expect(request.formData).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects malformed content-length before parsing multipart bodies', async () => {
    const token = createUploadSessionToken({ sessionId: 'session-1' });
    const { POST } = await loadRoute();

    for (const contentLength of ['not-a-number', '3.14', '1e6', '0x1000', '-1']) {
      const request = createFormRequest({ token, contentLength });
      request.formData = vi.fn(request.formData);
      const response = await POST(request);

      expect(response.status).toBe(400);
      expect(request.formData).not.toHaveBeenCalled();
    }
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects oversized content-length before parsing multipart bodies', async () => {
    const token = createUploadSessionToken({ sessionId: 'session-1' });
    const request = createFormRequest({
      token,
      contentLength: 3 * 1024 * 1024 + 64 * 1024 + 1,
    });
    request.formData = vi.fn(request.formData);
    const { POST } = await loadRoute();

    const response = await POST(request);

    expect(response.status).toBe(413);
    expect(request.formData).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects missing upload files before storage writes', async () => {
    const token = createUploadSessionToken({ sessionId: 'session-1' });
    const { POST } = await loadRoute();

    const response = await POST(createFormRequest({ token, includeFile: false }));

    expect(response.status).toBe(400);
    expect(save).not.toHaveBeenCalled();
  });

  it('validates content type, magic bytes, extension, and 3 MB size', async () => {
    const token = createUploadSessionToken({ sessionId: 'session-1' });
    const { POST } = await loadRoute();

    await expect(
      POST(createFormRequest({ token, file: webpFile({ type: 'image/gif' }) }))
    ).resolves.toMatchObject({ status: 400 });
    await expect(
      POST(createFormRequest({ token, file: webpFile({ name: 'photo.png' }) }))
    ).resolves.toMatchObject({ status: 400 });
    await expect(
      POST(createFormRequest({ token, file: pngFile({ sizePadding: 3 * 1024 * 1024 }) }))
    ).resolves.toMatchObject({ status: 400 });
    expect(save).not.toHaveBeenCalled();
  });

  it('stores valid files under the private cartoon reference-photo prefix', async () => {
    const token = createUploadSessionToken({ sessionId: 'session-1' });
    const { POST } = await loadRoute();

    const response = await POST(createFormRequest({ token }));
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body).toMatchObject({
      objectName: 'cartoon-orders/reference-photos/photo.webp',
      contentType: 'image/webp',
      size: 12,
      originalName: 'photo.webp',
    });
    expect(buildStorageObjectName).toHaveBeenCalledWith(
      'cartoon-orders/reference-photos',
      'photo.webp',
      'image/webp'
    );
    expect(fileRef).toHaveBeenCalledWith('cartoon-orders/reference-photos/photo.webp');
    expect(save).toHaveBeenCalledWith(expect.any(Buffer), {
      resumable: false,
      metadata: {
        contentType: 'image/webp',
      },
    });
    expect(appendCartoonUploadedObject).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-1',
        objectName: 'cartoon-orders/reference-photos/photo.webp',
        contentType: 'image/webp',
        size: 12,
        originalName: 'photo.webp',
      })
    );
    expect(
      verifyCartoonOrderUploadToken({
        token: body.uploadConfirmationToken,
        purpose: CARTOON_ORDER_UPLOAD_CONFIRMATION_PURPOSE,
        sessionId: 'session-1',
        objectName: 'cartoon-orders/reference-photos/photo.webp',
        contentType: 'image/webp',
        size: 12,
      })
    ).toMatchObject({ ok: true });
  });

  it('deletes the just-saved object when the persisted session rejects the upload', async () => {
    appendCartoonUploadedObject.mockResolvedValueOnce({ ok: false, reason: 'duplicate' });
    const token = createUploadSessionToken({ sessionId: 'session-1' });
    const { POST } = await loadRoute();

    const response = await POST(createFormRequest({ token }));
    const body = await readJson(response);

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      code: 'upload_session_duplicate',
      message: 'This photo has already been uploaded in the current session.',
    });
    expect(deleteFile).toHaveBeenCalledWith({ ignoreNotFound: true });
  });

  it('attempts cleanup when storage save fails after creating the file reference', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    save.mockRejectedValueOnce(new Error('gcs failed'));
    const token = createUploadSessionToken({ sessionId: 'session-1' });
    const { POST } = await loadRoute();

    const response = await POST(createFormRequest({ token }));

    expect(response.status).toBe(500);
    expect(deleteFile).toHaveBeenCalledWith({ ignoreNotFound: true });
    expect(appendCartoonUploadedObject).not.toHaveBeenCalled();
  });

  it('deletes the just-saved object when persistence throws after storage save', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    appendCartoonUploadedObject.mockRejectedValueOnce(new Error('mongo failed'));
    const token = createUploadSessionToken({ sessionId: 'session-1' });
    const { POST } = await loadRoute();

    const response = await POST(createFormRequest({ token }));

    expect(response.status).toBe(500);
    expect(deleteFile).toHaveBeenCalledWith({ ignoreNotFound: true });
  });
});
