import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { ensureServerEnvLoaded } from './env';

export const CARTOON_ORDER_UPLOAD_SESSION_PURPOSE = 'cartoon-order-upload-session';
export const CARTOON_ORDER_UPLOAD_CONFIRMATION_PURPOSE = 'cartoon-order-upload-confirmation';
export const CARTOON_ORDER_PHOTO_READ_PURPOSE = 'cartoon-order-photo-read';

const DEFAULT_UPLOAD_SESSION_TTL_MS = 20 * 60 * 1000;
const DEFAULT_UPLOAD_CONFIRMATION_TTL_MS = 60 * 60 * 1000;

function getTokenSecret() {
  ensureServerEnvLoaded();
  const secret = process.env.CARTOON_ORDER_UPLOAD_TOKEN_SECRET || process.env.JWT_SECRET;

  if (!secret || String(secret).trim() === '') {
    throw new Error('CARTOON_ORDER_UPLOAD_TOKEN_SECRET or JWT_SECRET is not configured.');
  }

  return secret;
}

function encodePayload(payload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function decodePayload(encodedPayload) {
  return JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
}

function createSignature(encodedPayload) {
  return createHmac('sha256', getTokenSecret()).update(encodedPayload).digest('base64url');
}

function timingSafeStringEqual(left, right) {
  const leftBuffer = Buffer.from(left || '');
  const rightBuffer = Buffer.from(right || '');

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function createCartoonOrderUploadToken(payload) {
  const encodedPayload = encodePayload({
    ...payload,
    nonce: payload.nonce || randomUUID(),
  });
  const signature = createSignature(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function createUploadSessionToken({
  sessionId,
  expiresAt = Date.now() + DEFAULT_UPLOAD_SESSION_TTL_MS,
} = {}) {
  return createCartoonOrderUploadToken({
    purpose: CARTOON_ORDER_UPLOAD_SESSION_PURPOSE,
    sessionId,
    iat: Date.now(),
    exp: Number(expiresAt),
  });
}

export function createUploadConfirmationToken({
  sessionId,
  objectName,
  contentType,
  size,
  expiresAt = Date.now() + DEFAULT_UPLOAD_CONFIRMATION_TTL_MS,
} = {}) {
  return createCartoonOrderUploadToken({
    purpose: CARTOON_ORDER_UPLOAD_CONFIRMATION_PURPOSE,
    sessionId,
    objectName,
    contentType,
    size: Number(size),
    iat: Date.now(),
    exp: Number(expiresAt),
  });
}

export function verifyCartoonOrderUploadToken({
  token,
  purpose,
  sessionId,
  objectName,
  contentType,
  size,
  now = Date.now(),
} = {}) {
  if (!token || typeof token !== 'string') {
    return { ok: false, message: 'Missing upload token.' };
  }

  const tokenParts = token.split('.');

  if (tokenParts.length !== 2) {
    return { ok: false, message: 'Invalid upload token.' };
  }

  try {
    const [encodedPayload, signature] = tokenParts;
    const expectedSignature = createSignature(encodedPayload);

    if (!timingSafeStringEqual(signature, expectedSignature)) {
      return { ok: false, message: 'Invalid upload token.' };
    }

    const payload = decodePayload(encodedPayload);

    if (payload?.purpose !== purpose) {
      return { ok: false, message: 'Invalid upload token purpose.' };
    }

    if (sessionId !== undefined && payload?.sessionId !== sessionId) {
      return { ok: false, message: 'Upload token session mismatch.' };
    }

    if (objectName !== undefined && payload?.objectName !== objectName) {
      return { ok: false, message: 'Upload token object mismatch.' };
    }

    if (contentType !== undefined && payload?.contentType !== contentType) {
      return { ok: false, message: 'Upload token content type mismatch.' };
    }

    if (size !== undefined && Number(payload?.size) !== Number(size)) {
      return { ok: false, message: 'Upload token size mismatch.' };
    }

    if (!Number.isFinite(Number(payload?.exp)) || Number(payload.exp) <= Number(now)) {
      return { ok: false, message: 'Upload token expired.' };
    }

    return { ok: true, payload };
  } catch {
    return { ok: false, message: 'Invalid upload token.' };
  }
}
