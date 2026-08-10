import { createHmac, timingSafeEqual } from 'crypto';

export function getRequiredJwtSecret({
  getEnvValue = () => '',
  prepareEnv = () => {},
  errorMessage = 'JWT_SECRET is not configured.',
} = {}) {
  prepareEnv();
  const secret = getEnvValue('JWT_SECRET');

  if (!secret || String(secret).trim() === '') {
    throw new Error(errorMessage);
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

export function verifyHs256JwtPayload({
  token,
  getJwtSecret = () => getRequiredJwtSecret(),
  nowInSeconds = Math.floor(Date.now() / 1000),
} = {}) {
  if (!token) {
    return { ok: false, status: 401, message: 'Missing authentication token.' };
  }

  const tokenParts = String(token).split('.');

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

    const expiresAt = Number(payload?.exp);

    if (!payload?.exp || !Number.isFinite(expiresAt)) {
      return { ok: false, status: 401, message: 'Authentication token is missing expiration.' };
    }

    const notBefore = payload?.nbf === undefined ? null : Number(payload.nbf);

    if (notBefore !== null && (!Number.isFinite(notBefore) || notBefore > nowInSeconds)) {
      return { ok: false, status: 401, message: 'Authentication token is not active yet.' };
    }

    if (expiresAt <= nowInSeconds) {
      return { ok: false, status: 401, message: 'Authentication token expired.' };
    }

    return { ok: true, payload };
  } catch (error) {
    if (error.message === 'JWT_SECRET is not configured.') {
      return { ok: false, status: 500, message: error.message };
    }

    return { ok: false, status: 401, message: 'Invalid authentication token.' };
  }
}
