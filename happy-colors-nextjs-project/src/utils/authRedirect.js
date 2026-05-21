const DEFAULT_REDIRECT_FALLBACK = '/products';
const LOGIN_PATH = '/users/login';
const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F]/;
const ENCODED_LEADING_SLASH_OR_BACKSLASH_PATTERN = /^(?:%2f|%5c)/i;

function getBaseOrigin(origin) {
  if (origin) {
    try {
      return new URL(origin).origin;
    } catch {
      return null;
    }
  }

  if (typeof window === 'undefined') {
    return null;
  }

  return window.location.origin;
}

function normalizePathForComparison(pathname) {
  return pathname.replace(/\/+$/, '').toLowerCase();
}

export function getSafeRedirectPath(
  value,
  fallback = DEFAULT_REDIRECT_FALLBACK,
  origin
) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const baseOrigin = getBaseOrigin(origin);

  if (!baseOrigin) {
    return fallback;
  }

  const trimmed = value.trim();

  if (
    !trimmed ||
    trimmed !== value ||
    CONTROL_CHAR_PATTERN.test(trimmed) ||
    trimmed.includes('\\') ||
    ENCODED_LEADING_SLASH_OR_BACKSLASH_PATTERN.test(trimmed)
  ) {
    return fallback;
  }

  try {
    const parsed = new URL(trimmed, baseOrigin);

    if (parsed.origin !== baseOrigin) {
      return fallback;
    }

    const normalizedPath = normalizePathForComparison(parsed.pathname);

    if (
      normalizedPath === LOGIN_PATH ||
      normalizedPath.startsWith(`${LOGIN_PATH}/`)
    ) {
      return fallback;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function buildLoginRedirectUrl(
  currentPathWithQuery,
  fallback = DEFAULT_REDIRECT_FALLBACK,
  origin
) {
  const safeRedirect = getSafeRedirectPath(currentPathWithQuery, fallback, origin);
  return `${LOGIN_PATH}?redirect=${encodeURIComponent(safeRedirect)}`;
}
