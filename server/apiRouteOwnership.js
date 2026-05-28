export const BACKEND_API_PREFIXES = Object.freeze([
  '/api/users',
  '/api/products',
  '/api/home-banners',
  '/api/blog-articles',
  '/api/newsletter',
  '/api/categories',
  '/api/search',
  '/api/contacts',
  '/api/orders',
  '/api/payments',
  '/api/delivery',
]);

function normalizePathname(pathname) {
  const normalized = String(pathname || '').trim() || '/';

  if (normalized === '/') {
    return normalized;
  }

  return normalized.replace(/\/+$/, '');
}

export function getRequestPathname(value = '') {
  const rawValue = String(value || '');

  try {
    return normalizePathname(new URL(rawValue, 'http://localhost').pathname);
  } catch {
    return normalizePathname(rawValue.split('?')[0]);
  }
}

export function isApiPath(value = '') {
  const pathname = getRequestPathname(value);

  return pathname === '/api' || pathname.startsWith('/api/');
}

export function isBackendApiPath(value = '') {
  const pathname = getRequestPathname(value);

  if (pathname === '/api') {
    return true;
  }

  return BACKEND_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
