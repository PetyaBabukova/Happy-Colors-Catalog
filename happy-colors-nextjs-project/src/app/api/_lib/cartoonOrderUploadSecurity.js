const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const MAX_RATE_LIMIT_KEYS = 2000;
const uploadSessionRateLimit = new Map();
const uploadRateLimit = new Map();

function getHeader(request, name) {
  return request?.headers?.get?.(name) || '';
}

function normalizeOrigin(value) {
  try {
    const url = new URL(String(value || '').trim());

    return `${url.protocol}//${url.host}`;
  } catch {
    return '';
  }
}

function getAllowedOrigins(request) {
  const host = getHeader(request, 'host');
  const forwardedProto = getHeader(request, 'x-forwarded-proto') || 'https';
  const configuredOrigins = String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const rawAllowedOrigins = [
    process.env.CLIENT_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.RENDER_EXTERNAL_URL,
    ...configuredOrigins,
  ];

  if (process.env.NODE_ENV !== 'production') {
    rawAllowedOrigins.push(
      host ? `${forwardedProto}://${host}` : '',
      host ? `https://${host}` : ''
    );
  }

  const allowedOrigins = new Set(rawAllowedOrigins.map(normalizeOrigin).filter(Boolean));

  return allowedOrigins;
}

export function validateCartoonUploadSameOrigin(request) {
  const origin = normalizeOrigin(getHeader(request, 'origin'));
  const referer = normalizeOrigin(getHeader(request, 'referer'));
  const allowedOrigins = getAllowedOrigins(request);
  const suppliedOrigin = origin || referer;

  if (!suppliedOrigin) {
    return process.env.NODE_ENV === 'production'
      ? { ok: false, status: 403, message: 'Missing request origin.' }
      : { ok: true };
  }

  if (!allowedOrigins.has(suppliedOrigin)) {
    return { ok: false, status: 403, message: 'Invalid request origin.' };
  }

  return { ok: true };
}

function getClientIp(request) {
  const realIp = getHeader(request, 'x-real-ip');

  if (realIp) {
    // Production edge/proxy must overwrite this header before the public gate is enabled.
    return realIp.trim();
  }

  const forwardedFor = getHeader(request, 'x-forwarded-for');

  if (forwardedFor) {
    const forwardedChain = forwardedFor.split(',').map((value) => value.trim()).filter(Boolean);

    return forwardedChain[0] || 'unknown';
  }

  return 'unknown';
}

function pruneExpiredRateLimitKeys(store, now) {
  if (store.size < MAX_RATE_LIMIT_KEYS) {
    return;
  }

  for (const [key, value] of store.entries()) {
    if (value.resetAt <= now) {
      store.delete(key);
    }
  }

  while (store.size >= MAX_RATE_LIMIT_KEYS) {
    const oldestKey = store.keys().next().value;

    if (!oldestKey) {
      break;
    }

    store.delete(oldestKey);
  }
}

function checkRateLimit(store, key, { now = Date.now(), limit }) {
  pruneExpiredRateLimitKeys(store, now);

  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { ok: true };
  }

  if (current.count >= limit) {
    return { ok: false, status: 429, message: 'Too many upload requests.' };
  }

  current.count += 1;
  return { ok: true };
}

export function checkCartoonUploadSessionRateLimit(request, options = {}) {
  return checkRateLimit(uploadSessionRateLimit, getClientIp(request), {
    limit: 20,
    ...options,
  });
}

export function checkCartoonUploadRateLimit(request, sessionId, options = {}) {
  const ip = getClientIp(request);

  return checkRateLimit(uploadRateLimit, `${ip}:${sessionId || 'missing-session'}`, {
    limit: 15,
    ...options,
  });
}

export function resetCartoonUploadRateLimitsForTests() {
  uploadSessionRateLimit.clear();
  uploadRateLimit.clear();
}
