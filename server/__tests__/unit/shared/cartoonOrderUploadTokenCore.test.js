import { createHmac } from 'crypto';
import { describe, expect, it } from 'vitest';

import {
  CARTOON_ORDER_UPLOAD_CONFIRMATION_PURPOSE,
  CARTOON_ORDER_UPLOAD_SESSION_PURPOSE,
  createCartoonOrderUploadTokenTools,
} from '../../../../shared/cartoonOrderUploadTokenCore.js';

function buildTokenTools(secret = 'test-secret-value') {
  return createCartoonOrderUploadTokenTools({
    getTokenSecret: () => secret,
  });
}

function createSignedToken(payload, secret = 'test-secret-value') {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret).update(encodedPayload).digest('base64url');

  return `${encodedPayload}.${signature}`;
}

describe('shared cartoon order upload token core', () => {
  it('creates and verifies upload session tokens with injected secrets', () => {
    const tools = buildTokenTools();
    const token = tools.createUploadSessionToken({
      sessionId: 'session-1',
      expiresAt: 2_000,
    });

    expect(tools.verifyCartoonOrderUploadToken({
      token,
      purpose: CARTOON_ORDER_UPLOAD_SESSION_PURPOSE,
      sessionId: 'session-1',
      now: 1_000,
    })).toMatchObject({
      ok: true,
      payload: {
        purpose: CARTOON_ORDER_UPLOAD_SESSION_PURPOSE,
        sessionId: 'session-1',
        exp: 2_000,
      },
    });
  });

  it('creates and verifies upload confirmation tokens with object details', () => {
    const tools = buildTokenTools();
    const token = tools.createUploadConfirmationToken({
      sessionId: 'session-1',
      objectName: 'cartoon-orders/reference-photos/photo.webp',
      contentType: 'image/webp',
      size: 123,
      expiresAt: 2_000,
    });

    expect(tools.verifyCartoonOrderUploadToken({
      token,
      purpose: CARTOON_ORDER_UPLOAD_CONFIRMATION_PURPOSE,
      sessionId: 'session-1',
      objectName: 'cartoon-orders/reference-photos/photo.webp',
      contentType: 'image/webp',
      size: 123,
      now: 1_000,
    })).toMatchObject({
      ok: true,
      payload: {
        purpose: CARTOON_ORDER_UPLOAD_CONFIRMATION_PURPOSE,
        sessionId: 'session-1',
        objectName: 'cartoon-orders/reference-photos/photo.webp',
        contentType: 'image/webp',
        size: 123,
      },
    });
  });

  it('rejects missing, malformed, and tampered tokens', () => {
    const tools = buildTokenTools();
    const token = tools.createUploadSessionToken({
      sessionId: 'session-1',
      expiresAt: 2_000,
    });
    const tamperedToken = token.replace(/\.[^.]+$/, '.bad-signature');

    expect(tools.verifyCartoonOrderUploadToken({
      token: '',
      purpose: CARTOON_ORDER_UPLOAD_SESSION_PURPOSE,
    })).toEqual({ ok: false, message: 'Missing upload token.' });
    expect(tools.verifyCartoonOrderUploadToken({
      token: 'not-a-valid-token',
      purpose: CARTOON_ORDER_UPLOAD_SESSION_PURPOSE,
    })).toEqual({ ok: false, message: 'Invalid upload token.' });
    expect(tools.verifyCartoonOrderUploadToken({
      token: tamperedToken,
      purpose: CARTOON_ORDER_UPLOAD_SESSION_PURPOSE,
      now: 1_000,
    })).toEqual({ ok: false, message: 'Invalid upload token.' });
  });

  it('rejects tokens signed with another injected secret', () => {
    const signedWithA = buildTokenTools('secret-a').createUploadSessionToken({
      sessionId: 'session-1',
      expiresAt: 2_000,
    });

    expect(buildTokenTools('secret-b').verifyCartoonOrderUploadToken({
      token: signedWithA,
      purpose: CARTOON_ORDER_UPLOAD_SESSION_PURPOSE,
      now: 1_000,
    })).toEqual({ ok: false, message: 'Invalid upload token.' });
  });

  it('rejects mismatched purpose, session, object, content type, size, and expiration', () => {
    const tools = buildTokenTools();
    const token = tools.createUploadConfirmationToken({
      sessionId: 'session-1',
      objectName: 'cartoon-orders/reference-photos/photo.webp',
      contentType: 'image/webp',
      size: 123,
      expiresAt: 2_000,
    });

    expect(tools.verifyCartoonOrderUploadToken({
      token,
      purpose: CARTOON_ORDER_UPLOAD_SESSION_PURPOSE,
      now: 1_000,
    })).toEqual({ ok: false, message: 'Invalid upload token purpose.' });
    expect(tools.verifyCartoonOrderUploadToken({
      token,
      purpose: CARTOON_ORDER_UPLOAD_CONFIRMATION_PURPOSE,
      sessionId: 'session-2',
      now: 1_000,
    })).toEqual({ ok: false, message: 'Upload token session mismatch.' });
    expect(tools.verifyCartoonOrderUploadToken({
      token,
      purpose: CARTOON_ORDER_UPLOAD_CONFIRMATION_PURPOSE,
      objectName: 'cartoon-orders/reference-photos/other.webp',
      now: 1_000,
    })).toEqual({ ok: false, message: 'Upload token object mismatch.' });
    expect(tools.verifyCartoonOrderUploadToken({
      token,
      purpose: CARTOON_ORDER_UPLOAD_CONFIRMATION_PURPOSE,
      contentType: 'image/png',
      now: 1_000,
    })).toEqual({ ok: false, message: 'Upload token content type mismatch.' });
    expect(tools.verifyCartoonOrderUploadToken({
      token,
      purpose: CARTOON_ORDER_UPLOAD_CONFIRMATION_PURPOSE,
      size: 456,
      now: 1_000,
    })).toEqual({ ok: false, message: 'Upload token size mismatch.' });
    expect(tools.verifyCartoonOrderUploadToken({
      token,
      purpose: CARTOON_ORDER_UPLOAD_CONFIRMATION_PURPOSE,
      now: 2_000,
    })).toEqual({ ok: false, message: 'Upload token expired.' });
  });

  it('rejects tokens with non-finite expiration values', () => {
    const tools = buildTokenTools();
    const token = createSignedToken({
      purpose: CARTOON_ORDER_UPLOAD_SESSION_PURPOSE,
      sessionId: 'session-1',
      exp: 'not-a-time',
    });

    expect(tools.verifyCartoonOrderUploadToken({
      token,
      purpose: CARTOON_ORDER_UPLOAD_SESSION_PURPOSE,
      sessionId: 'session-1',
      now: 1_000,
    })).toEqual({ ok: false, message: 'Upload token expired.' });
  });
});
