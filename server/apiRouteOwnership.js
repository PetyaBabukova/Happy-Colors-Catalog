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

export const BACKEND_API_EXACT_PATHS = Object.freeze([
  '/api/cartoon-orders',
]);

export const NEXT_API_EXACT_PATHS = Object.freeze([
  '/api/cartoon-orders/upload-session',
  '/api/cartoon-orders/uploads',
]);

const CARTOON_ORDER_ADMIN_API_PATH_RE =
  /^\/api\/cartoon-orders\/[a-fA-F0-9]{24}(?:\/(?:statuses|admin-notes|complete))?$/;

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

  if (BACKEND_API_EXACT_PATHS.includes(pathname)) {
    return true;
  }

  if (NEXT_API_EXACT_PATHS.includes(pathname)) {
    return false;
  }

  if (CARTOON_ORDER_ADMIN_API_PATH_RE.test(pathname)) {
    return true;
  }

  return BACKEND_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
