import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CARTOON_ORDER_UPLOAD_CONFIRMATION_PURPOSE as NEXT_CONFIRMATION_PURPOSE,
  CARTOON_ORDER_UPLOAD_SESSION_PURPOSE as NEXT_SESSION_PURPOSE,
  createUploadConfirmationToken as createNextUploadConfirmationToken,
  createUploadSessionToken as createNextUploadSessionToken,
  verifyCartoonOrderUploadToken as verifyNextUploadToken,
} from '../../../src/app/api/_lib/cartoonOrderUploadToken.js';
import {
  CARTOON_ORDER_UPLOAD_CONFIRMATION_PURPOSE as EXPRESS_CONFIRMATION_PURPOSE,
  CARTOON_ORDER_UPLOAD_SESSION_PURPOSE as EXPRESS_SESSION_PURPOSE,
  createUploadConfirmationToken as createExpressUploadConfirmationToken,
  createUploadSessionToken as createExpressUploadSessionToken,
  verifyCartoonOrderUploadToken as verifyExpressUploadToken,
} from '../../../../server/helpers/cartoonOrderUploadToken.js';

describe('cartoon order upload token cross-runtime contract', () => {
  beforeEach(() => {
    vi.stubEnv('CARTOON_ORDER_UPLOAD_TOKEN_SECRET', 'cross-runtime-upload-secret');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('allows Express to verify upload session tokens issued by Next', () => {
    const token = createNextUploadSessionToken({
      sessionId: 'session-1',
      expiresAt: Date.now() + 60_000,
    });

    expect(
      verifyExpressUploadToken({
        token,
        purpose: EXPRESS_SESSION_PURPOSE,
        sessionId: 'session-1',
      })
    ).toMatchObject({ ok: true });
  });

  it('allows Next to verify upload confirmation tokens issued by Express', () => {
    const token = createExpressUploadConfirmationToken({
      sessionId: 'session-1',
      objectName: 'cartoon-orders/reference-photos/photo.webp',
      contentType: 'image/webp',
      size: 1234,
      expiresAt: Date.now() + 60_000,
    });

    expect(
      verifyNextUploadToken({
        token,
        purpose: NEXT_CONFIRMATION_PURPOSE,
        sessionId: 'session-1',
        objectName: 'cartoon-orders/reference-photos/photo.webp',
        contentType: 'image/webp',
        size: 1234,
      })
    ).toMatchObject({ ok: true });
  });

  it('rejects purpose, expiry, object, session, content type, and size mismatches', () => {
    const token = createNextUploadConfirmationToken({
      sessionId: 'session-1',
      objectName: 'cartoon-orders/reference-photos/photo.webp',
      contentType: 'image/webp',
      size: 1234,
      expiresAt: Date.now() + 60_000,
    });

    expect(
      verifyExpressUploadToken({
        token,
        purpose: EXPRESS_SESSION_PURPOSE,
        sessionId: 'session-1',
      })
    ).toMatchObject({ ok: false });
    expect(
      verifyExpressUploadToken({
        token,
        purpose: EXPRESS_CONFIRMATION_PURPOSE,
        sessionId: 'session-2',
        objectName: 'cartoon-orders/reference-photos/photo.webp',
        contentType: 'image/webp',
        size: 1234,
      })
    ).toMatchObject({ ok: false });
    expect(
      verifyExpressUploadToken({
        token,
        purpose: EXPRESS_CONFIRMATION_PURPOSE,
        sessionId: 'session-1',
        objectName: 'cartoon-orders/reference-photos/other.webp',
        contentType: 'image/webp',
        size: 1234,
      })
    ).toMatchObject({ ok: false });
    expect(
      verifyExpressUploadToken({
        token,
        purpose: EXPRESS_CONFIRMATION_PURPOSE,
        sessionId: 'session-1',
        objectName: 'cartoon-orders/reference-photos/photo.webp',
        contentType: 'image/png',
        size: 1234,
      })
    ).toMatchObject({ ok: false });
    expect(
      verifyExpressUploadToken({
        token,
        purpose: EXPRESS_CONFIRMATION_PURPOSE,
        sessionId: 'session-1',
        objectName: 'cartoon-orders/reference-photos/photo.webp',
        contentType: 'image/webp',
        size: 4321,
      })
    ).toMatchObject({ ok: false });

    const expiredToken = createExpressUploadSessionToken({
      sessionId: 'session-1',
      expiresAt: Date.now() - 1000,
    });

    expect(
      verifyNextUploadToken({
        token: expiredToken,
        purpose: NEXT_SESSION_PURPOSE,
        sessionId: 'session-1',
      })
    ).toMatchObject({ ok: false });
  });
});
