import { createHmac, timingSafeEqual } from 'crypto';
import { ensureServerEnvLoaded } from './env';

const AUTH_COOKIE_NAME = 'token';
// TODO: Keep this verifier aligned with server/middlewares/auth.js, which validates the same cookie on the Express side.

function getJwtSecret() {
  ensureServerEnvLoaded();
  const secret = process.env.JWT_SECRET;

  if (!secret || String(secret).trim() === '') {
    throw new Error('JWT_SECRET is not configured.');
  }

  return secret;
}

function decodeBase64UrlSegment(segment) {
  return Buffer.from(segment, 'base64url').toString('utf8');
}

function parseJsonSegment(segment) {
  return JSON.parse(decodeBase64UrlSegment(segment));
}

function createExpectedSignature(unsignedToken, secret) {
  return createHmac('sha256', secret)
    .update(unsignedToken)
    .digest('base64url');
}

function verifyTokenSignature(unsignedToken, providedSignature, secret) {
  const expectedSignature = createExpectedSignature(unsignedToken, secret);
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

export function requireApiAuth(request) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return { ok: false, status: 401, message: 'Missing authentication token.' };
  }

  const tokenParts = token.split('.');

  if (tokenParts.length !== 3) {
    return { ok: false, status: 401, message: 'Invalid authentication token.' };
  }

  try {
    const [encodedHeader, encodedPayload, signature] = tokenParts;
    const header = parseJsonSegment(encodedHeader);

    if (header?.alg !== 'HS256') {
      return { ok: false, status: 401, message: 'Unsupported token algorithm.' };
    }

    const secret = getJwtSecret();
    const unsignedToken = `${encodedHeader}.${encodedPayload}`;

    if (!verifyTokenSignature(unsignedToken, signature, secret)) {
      return { ok: false, status: 401, message: 'Invalid authentication token.' };
    }

    const payload = parseJsonSegment(encodedPayload);
    const nowInSeconds = Math.floor(Date.now() / 1000);

    if (!payload?.exp) {
      return { ok: false, status: 401, message: 'Authentication token is missing expiration.' };
    }

    if (payload?.nbf && Number(payload.nbf) > nowInSeconds) {
      return { ok: false, status: 401, message: 'Authentication token is not active yet.' };
    }

    if (Number(payload.exp) <= nowInSeconds) {
      return { ok: false, status: 401, message: 'Authentication token expired.' };
    }

    return { ok: true, user: payload };
  } catch (error) {
    if (error.message === 'JWT_SECRET is not configured.') {
      return { ok: false, status: 500, message: error.message };
    }

    return { ok: false, status: 401, message: 'Invalid authentication token.' };
  }
}
