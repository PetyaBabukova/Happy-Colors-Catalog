import { NextResponse } from 'next/server';

const AUTH_COOKIE_NAME = 'token';
const PROTECTED_PAGE_PREFIXES = [
  '/blog/create',
  '/categories',
  '/home-banners/create',
  '/homepage-featured',
  '/newsletter/send',
  '/products/create',
  '/users',
];
const PROTECTED_PAGE_PATTERNS = [
  /^\/blog\/[^/]+\/edit\/?$/,
  /^\/home-banners\/[^/]+\/edit\/?$/,
  /^\/products\/[^/]+\/delete\/?$/,
  /^\/products\/[^/]+\/edit\/?$/,
];

export function isProtectedPagePath(pathname = '') {
  const normalizedPath = pathname === '/' ? pathname : pathname.replace(/\/+$/, '');

  return (
    PROTECTED_PAGE_PREFIXES.some((prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)) ||
    PROTECTED_PAGE_PATTERNS.some((pattern) => pattern.test(normalizedPath))
  );
}

export function middleware(request) {
  const { pathname, search } = request.nextUrl;

  if (!isProtectedPagePath(pathname) || request.cookies.has(AUTH_COOKIE_NAME)) {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/users/login';
  loginUrl.search = '';
  loginUrl.searchParams.set('redirect', `${pathname}${search}`);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    '/blog/create/:path*',
    '/blog/:path*/edit',
    '/categories/:path*',
    '/home-banners/create/:path*',
    '/home-banners/:path*/edit',
    '/homepage-featured/:path*',
    '/newsletter/send/:path*',
    '/products/create/:path*',
    '/products/:path*/delete',
    '/products/:path*/edit',
    '/users',
  ],
};
