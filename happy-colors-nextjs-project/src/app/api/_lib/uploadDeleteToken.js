import { createHmac, timingSafeEqual } from 'crypto';
import { ensureServerEnvLoaded } from './env';

const DELETE_TOKEN_TTL_MS = 20 * 60 * 1000;
const DELETE_TOKEN_PURPOSE = 'unattached-upload-delete';

function getDeleteTokenSecret() {
  ensureServerEnvLoaded();
  const secret = process.env.UPLOAD_DELETE_TOKEN_SECRET || process.env.JWT_SECRET;

  if (!secret || String(secret).trim() === '') {
    throw new Error('UPLOAD_DELETE_TOKEN_SECRET or JWT_SECRET is not configured.');
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
  return createHmac('sha256', getDeleteTokenSecret())
    .update(encodedPayload)
    .digest('base64url');
}

function timingSafeStringEqual(left, right) {
  const leftBuffer = Buffer.from(left || '');
  const rightBuffer = Buffer.from(right || '');

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function createUploadDeleteToken({ objectName, userId }) {
  const payload = {
    purpose: DELETE_TOKEN_PURPOSE,
    objectName,
    userId: String(userId || ''),
    exp: Date.now() + DELETE_TOKEN_TTL_MS,
  };
  const encodedPayload = encodePayload(payload);
  const signature = createSignature(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function verifyUploadDeleteToken({ token, objectName, userId }) {
  if (!token || typeof token !== 'string') {
    return { ok: false, message: 'Missing delete token.' };
  }

  const tokenParts = token.split('.');

  if (tokenParts.length !== 2) {
    return { ok: false, message: 'Invalid delete token.' };
  }

  try {
    const [encodedPayload, signature] = tokenParts;
    const expectedSignature = createSignature(encodedPayload);

    if (!timingSafeStringEqual(signature, expectedSignature)) {
      return { ok: false, message: 'Invalid delete token.' };
    }

    const payload = decodePayload(encodedPayload);

    if (payload?.purpose !== DELETE_TOKEN_PURPOSE) {
      return { ok: false, message: 'Invalid delete token purpose.' };
    }

    if (payload?.objectName !== objectName || String(payload?.userId || '') !== String(userId || '')) {
      return { ok: false, message: 'Delete token does not match this upload.' };
    }

    if (!Number.isFinite(Number(payload?.exp)) || Number(payload.exp) <= Date.now()) {
      return { ok: false, message: 'Delete token expired.' };
    }

    return { ok: true };
  } catch {
    return { ok: false, message: 'Invalid delete token.' };
  }
}
