import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readJson } from '../_helpers.js';
import {
  createUploadConfirmationToken,
  createUploadSessionToken,
} from '../../../src/app/api/_lib/cartoonOrderUploadToken.js';

const acquireCartoonUploadCleanupLock = vi.fn();
const markCartoonUploadedObjectByteGaugeReleased = vi.fn();
const removeCartoonUploadedObjectAfterCleanup = vi.fn();
const releaseCartoonUploadCleanupLock = vi.fn();
const decrementUploadByteQuotaForGuardRefs = vi.fn();
const deleteFile = vi.fn();
const fileRef = vi.fn(() => ({ delete: deleteFile }));
const bucket = vi.fn(() => ({ file: fileRef }));
const getStorage = vi.fn(() => ({ bucket }));
let bucketName;

function createJsonRequest({
  body,
  origin = 'https://happycolors.test',
  host = 'happycolors.test',
  forwardedFor = '203.0.113.11',
} = {}) {
  const headers = new Map([
    ['origin', origin],
    ['host', host],
    ['x-forwarded-proto', 'https'],
    ['x-forwarded-for', forwardedFor],
  ]);

  return {
    json: vi.fn(async () => body),
    headers: {
      get: (name) => headers.get(String(name).toLowerCase()) || null,
    },
  };
}

function confirmationToken({
  sessionId = 'session-1',
  objectName = 'cartoon-orders/reference-photos/photo.webp',
  contentType = 'image/webp',
  size = 1234,
} = {}) {
  return createUploadConfirmationToken({
    sessionId,
    objectName,
    contentType,
    size,
  });
}

async function loadRoute() {
  return import('../../../src/app/api/cartoon-orders/uploads/cleanup/route.js');
}

describe('/api/cartoon-orders/uploads/cleanup', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('CARTOON_ORDER_UPLOAD_TOKEN_SECRET', 'test-cartoon-upload-secret');
    vi.stubEnv('NEXT_PUBLIC_CARTOONS_SERVICE_ENABLED', 'true');
    bucketName = 'private-cartoon-bucket';
    acquireCartoonUploadCleanupLock.mockResolvedValue({
      ok: true,
      cleanupLockedAt: new Date('2026-06-18T10:00:00Z'),
    });
    markCartoonUploadedObjectByteGaugeReleased.mockResolvedValue({
      ok: true,
      uploadedObject: {
        guard: {
          browserHmac: 'browser-hmac',
          ipHmac: 'ip-hmac',
        },
        size: 1234,
      },
    });
    removeCartoonUploadedObjectAfterCleanup.mockResolvedValue({ ok: true });
    releaseCartoonUploadCleanupLock.mockResolvedValue(undefined);
    decrementUploadByteQuotaForGuardRefs.mockResolvedValue(undefined);
    deleteFile.mockResolvedValue(undefined);

    vi.doMock('../../../src/app/api/_lib/gcs.js', () => ({
      getCartoonOrdersBucketName: vi.fn(() => bucketName),
      getStorage,
      isCartoonOrderPhotoObjectName: vi.fn((objectName) => (
        typeof objectName === 'string' &&
        objectName.startsWith('cartoon-orders/reference-photos/') &&
        !objectName.split('/').some((part) => part === '..' || part === '.' || part.includes('\\'))
      )),
    }));
    vi.doMock('../../../src/app/api/_lib/cartoonUploadSessionStore.js', () => ({
      acquireCartoonUploadCleanupLock,
      markCartoonUploadedObjectByteGaugeReleased,
      removeCartoonUploadedObjectAfterCleanup,
      releaseCartoonUploadCleanupLock,
    }));
    vi.doMock('../../../src/app/api/_lib/cartoonUploadQuotaGuards.js', () => ({
      decrementUploadByteQuotaForGuardRefs,
    }));
  });

  it('rejects missing or invalid upload session tokens', async () => {
    const { POST } = await loadRoute();
    const response = await POST(createJsonRequest({
      body: {
        uploadSessionToken: '',
        uploadConfirmationTokens: [confirmationToken()],
      },
    }));

    expect(response.status).toBe(401);
    expect(acquireCartoonUploadCleanupLock).not.toHaveBeenCalled();
  });

  it('rejects confirmation tokens from another session before storage deletion', async () => {
    const { POST } = await loadRoute();
    const response = await POST(createJsonRequest({
      body: {
        uploadSessionToken: createUploadSessionToken({ sessionId: 'session-1' }),
        uploadConfirmationTokens: [confirmationToken({ sessionId: 'session-2' })],
      },
    }));

    expect(response.status).toBe(401);
    expect(deleteFile).not.toHaveBeenCalled();
  });

  it('rejects raw object-name-only cleanup attempts', async () => {
    const { POST } = await loadRoute();
    const response = await POST(createJsonRequest({
      body: {
        uploadSessionToken: createUploadSessionToken({ sessionId: 'session-1' }),
        objectNames: ['cartoon-orders/reference-photos/photo.webp'],
        uploadConfirmationTokens: [],
      },
    }));

    expect(response.status).toBe(400);
    expect(acquireCartoonUploadCleanupLock).not.toHaveBeenCalled();
  });

  it('deletes an unclaimed uploaded photo after acquiring a cleanup lock', async () => {
    const token = confirmationToken();
    const { POST } = await loadRoute();
    const response = await POST(createJsonRequest({
      body: {
        uploadSessionToken: createUploadSessionToken({ sessionId: 'session-1' }),
        uploadConfirmationTokens: [token],
      },
    }));
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body).toEqual({ deletedCount: 1, failedCount: 0 });
    expect(acquireCartoonUploadCleanupLock).toHaveBeenCalledWith({
      sessionId: 'session-1',
      objectName: 'cartoon-orders/reference-photos/photo.webp',
    });
    expect(deleteFile).toHaveBeenCalledWith({ ignoreNotFound: false });
    expect(markCartoonUploadedObjectByteGaugeReleased).toHaveBeenCalledWith({
      sessionId: 'session-1',
      objectName: 'cartoon-orders/reference-photos/photo.webp',
      cleanupLockedAt: new Date('2026-06-18T10:00:00Z'),
    });
    expect(decrementUploadByteQuotaForGuardRefs).toHaveBeenCalledWith({
      guard: {
        browserHmac: 'browser-hmac',
        ipHmac: 'ip-hmac',
      },
      size: 1234,
    });
    expect(removeCartoonUploadedObjectAfterCleanup).toHaveBeenCalledWith({
      sessionId: 'session-1',
      objectName: 'cartoon-orders/reference-photos/photo.webp',
      cleanupLockedAt: new Date('2026-06-18T10:00:00Z'),
    });
    expect(JSON.stringify(body)).not.toContain('cartoon-orders/reference-photos');
    expect(JSON.stringify(body)).not.toContain('session-1');
    expect(JSON.stringify(body)).not.toContain(token);
  });

  it('returns a retryable aggregate failure when cleanup cannot acquire the lock', async () => {
    acquireCartoonUploadCleanupLock.mockResolvedValueOnce({
      ok: false,
      cleanupLockedAt: new Date('2026-06-18T10:00:00Z'),
    });
    const { POST } = await loadRoute();
    const response = await POST(createJsonRequest({
      body: {
        uploadSessionToken: createUploadSessionToken({ sessionId: 'session-1' }),
        uploadConfirmationTokens: [confirmationToken()],
      },
    }));
    const body = await readJson(response);

    expect(response.status).toBe(409);
    expect(body).toEqual({ deletedCount: 0, failedCount: 1 });
    expect(deleteFile).not.toHaveBeenCalled();
  });

  it('releases the cleanup lock when storage deletion fails', async () => {
    deleteFile.mockRejectedValueOnce(Object.assign(new Error('storage down'), { code: '503' }));
    const { POST } = await loadRoute();
    const response = await POST(createJsonRequest({
      body: {
        uploadSessionToken: createUploadSessionToken({ sessionId: 'session-1' }),
        uploadConfirmationTokens: [confirmationToken()],
      },
    }));
    const body = await readJson(response);

    expect(response.status).toBe(409);
    expect(body).toEqual({ deletedCount: 0, failedCount: 1 });
    expect(removeCartoonUploadedObjectAfterCleanup).not.toHaveBeenCalled();
    expect(decrementUploadByteQuotaForGuardRefs).not.toHaveBeenCalled();
    expect(releaseCartoonUploadCleanupLock).toHaveBeenCalledWith({
      sessionId: 'session-1',
      objectName: 'cartoon-orders/reference-photos/photo.webp',
      cleanupLockedAt: new Date('2026-06-18T10:00:00Z'),
      failureCategory: 'storage_delete_failed',
    });
  });

  it('returns aggregate partial counts without exposing per-object cleanup outcomes', async () => {
    deleteFile
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(Object.assign(new Error('storage down'), { code: '503' }));
    const { POST } = await loadRoute();
    const response = await POST(createJsonRequest({
      body: {
        uploadSessionToken: createUploadSessionToken({ sessionId: 'session-1' }),
        uploadConfirmationTokens: [
          confirmationToken({ objectName: 'cartoon-orders/reference-photos/first.webp' }),
          confirmationToken({ objectName: 'cartoon-orders/reference-photos/second.webp' }),
        ],
      },
    }));
    const body = await readJson(response);

    expect(response.status).toBe(409);
    expect(body).toEqual({ deletedCount: 1, failedCount: 1 });
    expect(removeCartoonUploadedObjectAfterCleanup).toHaveBeenCalledTimes(1);
    expect(releaseCartoonUploadCleanupLock).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(body)).not.toContain('first.webp');
    expect(JSON.stringify(body)).not.toContain('second.webp');
  });

  it('keeps the cleanup lock when storage is deleted but session removal fails', async () => {
    removeCartoonUploadedObjectAfterCleanup.mockResolvedValueOnce({ ok: false });
    const { POST } = await loadRoute();
    const response = await POST(createJsonRequest({
      body: {
        uploadSessionToken: createUploadSessionToken({ sessionId: 'session-1' }),
        uploadConfirmationTokens: [confirmationToken()],
      },
    }));
    const body = await readJson(response);

    expect(response.status).toBe(409);
    expect(body).toEqual({ deletedCount: 0, failedCount: 1 });
    expect(deleteFile).toHaveBeenCalledWith({ ignoreNotFound: false });
    expect(releaseCartoonUploadCleanupLock).not.toHaveBeenCalled();
  });

  it('still removes the session object when byte-gauge decrement fails after storage deletion', async () => {
    decrementUploadByteQuotaForGuardRefs.mockRejectedValueOnce(new Error('counter write failed'));
    const { POST } = await loadRoute();
    const response = await POST(createJsonRequest({
      body: {
        uploadSessionToken: createUploadSessionToken({ sessionId: 'session-1' }),
        uploadConfirmationTokens: [confirmationToken()],
      },
    }));
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body).toEqual({ deletedCount: 1, failedCount: 0 });
    expect(removeCartoonUploadedObjectAfterCleanup).toHaveBeenCalledWith({
      sessionId: 'session-1',
      objectName: 'cartoon-orders/reference-photos/photo.webp',
      cleanupLockedAt: new Date('2026-06-18T10:00:00Z'),
    });
    expect(releaseCartoonUploadCleanupLock).not.toHaveBeenCalled();
  });

  it('enforces the public cartoons-service gate', async () => {
    vi.stubEnv('NEXT_PUBLIC_CARTOONS_SERVICE_ENABLED', 'false');
    const { POST } = await loadRoute();
    const disabledResponse = await POST(createJsonRequest({ body: {} }));

    expect(disabledResponse.status).toBe(404);
    expect(acquireCartoonUploadCleanupLock).not.toHaveBeenCalled();
  });

  it('enforces same-origin checks', async () => {
    const { POST } = await loadRoute();
    const originResponse = await POST(createJsonRequest({
      origin: 'https://evil.test',
      body: {
        uploadSessionToken: createUploadSessionToken({ sessionId: 'session-1' }),
        uploadConfirmationTokens: [confirmationToken()],
      },
    }));

    expect(originResponse.status).toBe(403);
    expect(acquireCartoonUploadCleanupLock).not.toHaveBeenCalled();
  });
});
