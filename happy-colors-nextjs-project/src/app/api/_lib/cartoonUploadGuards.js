import { createHmac, randomBytes } from 'crypto';

import { ensureServerEnvLoaded } from './env';

const DEFAULT_BROWSER_GUARD_COOKIE_NAME = 'hc_cartoon_guard';
const DEFAULT_BROWSER_GUARD_COOKIE_MAX_AGE_DAYS = 30;
const DEFAULT_TRUSTED_CLIENT_IP_HEADER = 'x-real-ip';
const MIN_GUARD_SECRET_LENGTH = 32;

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

export function arePersistentCartoonGuardsEnabled() {
  return process.env.CARTOON_PERSISTENT_ABUSE_GUARDS_ENABLED === 'true';
}

function getGuardSecret() {
  ensureServerEnvLoaded();
  const secret = String(process.env.CARTOON_GUARD_HMAC_SECRET || '').trim();

  if (!secret) {
    throw new Error('CARTOON_GUARD_HMAC_SECRET is not configured.');
  }

  if (secret.length < MIN_GUARD_SECRET_LENGTH) {
    throw new Error('CARTOON_GUARD_HMAC_SECRET must be at least 32 characters.');
  }

  return secret;
}

export function createCartoonGuardHmacKey({ keyType, value }) {
  const normalizedKeyType = String(keyType || '').trim();
  const normalizedValue = String(value || '').trim();

  if (!['browser', 'ip'].includes(normalizedKeyType)) {
    throw new Error('Unsupported cartoon guard key type.');
  }

  if (!normalizedValue) {
    throw new Error('Cartoon guard key input is required.');
  }

  return createHmac('sha256', getGuardSecret())
    .update(`${normalizedKeyType}:${normalizedValue}`)
    .digest('base64url');
}

export function createBrowserGuardCookieValue() {
  return randomBytes(32).toString('base64url');
}

export function getBrowserGuardCookieName() {
  return String(process.env.CARTOON_BROWSER_GUARD_COOKIE_NAME || DEFAULT_BROWSER_GUARD_COOKIE_NAME)
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, '') || DEFAULT_BROWSER_GUARD_COOKIE_NAME;
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getBrowserGuardCookieMaxAgeSeconds() {
  const windowHours = parsePositiveInteger(
    process.env.CARTOON_ORDER_SUCCESSFUL_INQUIRY_WINDOW_HOURS,
    24
  );
  const defaultMaxAge = DEFAULT_BROWSER_GUARD_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
  const configuredMaxAge = parsePositiveInteger(
    process.env.CARTOON_BROWSER_GUARD_COOKIE_MAX_AGE_SECONDS,
    defaultMaxAge
  );

  return Math.max(configuredMaxAge, windowHours * 60 * 60);
}

export function getBrowserGuardCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction(),
    path: '/',
    maxAge: getBrowserGuardCookieMaxAgeSeconds(),
  };
}

export function setBrowserGuardCookie(response, value = createBrowserGuardCookieValue()) {
  response.cookies.set(getBrowserGuardCookieName(), value, getBrowserGuardCookieOptions());

  return value;
}

export function getTrustedClientIpFromNextRequest(request) {
  const headerName = String(
    process.env.CARTOON_TRUSTED_CLIENT_IP_HEADER || DEFAULT_TRUSTED_CLIENT_IP_HEADER
  ).toLowerCase();
  const value = request?.headers?.get?.(headerName);

  const trustedIp = String(value || '').split(',')[0].trim();

  if (!trustedIp && isProduction() && arePersistentCartoonGuardsEnabled()) {
    throw new Error('Trusted client IP header is required for cartoon abuse guards.');
  }

  return trustedIp || 'unknown';
}
