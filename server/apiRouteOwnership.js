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
  '/api/translations',
]);

export const BACKEND_API_EXACT_PATHS = Object.freeze([
  '/api/cartoon-orders',
  '/api/cartoon-orders/purge-old-completed',
  '/api/cartoon-orders/upload-cleanup/status',
  '/api/cartoon-orders/upload-cleanup/run',
]);

export const NEXT_API_EXACT_PATHS = Object.freeze([
  '/api/cartoon-orders/upload-session',
  '/api/cartoon-orders/uploads',
  '/api/cartoon-orders/uploads/cleanup',
]);

const CARTOON_ORDER_ADMIN_API_PATH_RE =
  /^\/api\/cartoon-orders\/[a-fA-F0-9]{24}(?:\/(?:statuses|admin-notes|workflow|reject|complete|photo-diagnostics|notifications\/retry))?$/;
const CARTOON_ORDER_ADMIN_PHOTO_API_PATH_RE =
  /^\/api\/cartoon-orders\/[a-fA-F0-9]{24}\/photos\/[A-Za-z0-9_-]{1,80}$/;

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

  if (CARTOON_ORDER_ADMIN_PHOTO_API_PATH_RE.test(pathname)) {
    return true;
  }

  return BACKEND_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
