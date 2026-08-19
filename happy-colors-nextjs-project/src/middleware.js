import { NextResponse } from 'next/server';
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  LOCALE_REQUEST_HEADER,
  getEnabledPublicLocales,
  isEnabledPublicLocale,
  isEnglishPublicLocaleEnabled,
  isLocaleRoutingEnabled,
} from '@/i18n/config';
import {
  filterPublicSearchParams,
  getRequestCountryCode,
  getPathLocale,
  localizePath,
  selectLocaleForCountry,
  stripPathLocale,
} from '@/i18n/routing';
import { AUTH_COOKIE_NAME } from '../../shared/authConstants.js';

export const ENGLISH_UNAVAILABLE_NOTICE_QUERY = 'localeNotice';
export const ENGLISH_UNAVAILABLE_NOTICE_VALUE = 'english-unavailable';

const PUBLIC_EXACT_PATHS = new Set([
  '/aboutus',
  '/blog',
  '/cartoons',
  '/cartoons/offer',
  '/contacts',
  '/faq',
  '/gifts',
  '/newsletter/confirm',
  '/newsletter/preferences',
  '/newsletter/unsubscribe',
  '/partners',
  '/products',
  '/search',
]);
const PRODUCT_RESERVED_SEGMENTS = new Set(['create']);
const BLOG_RESERVED_SEGMENTS = new Set(['create']);
const GIFT_RESERVED_SEGMENTS = new Set([]);
const TOKEN_QUERY_PARAM = 'token';
const NEWSLETTER_TOKEN_PAGE_PATHS = new Set([
  '/newsletter/confirm',
  '/newsletter/preferences',
  '/newsletter/unsubscribe',
]);
const PROTECTED_PAGE_PREFIXES = [
  '/blog/create',
  '/categories',
  '/home-banners/create',
  '/homepage-featured',
  '/newsletter/send',
  '/products/create',
  '/translations',
  '/users',
];
const PROTECTED_PAGE_PATTERNS = [
  /^\/blog\/[^/]+\/edit\/?$/,
  /^\/home-banners\/[^/]+\/edit\/?$/,
  /^\/products\/[^/]+\/delete\/?$/,
  /^\/products\/[^/]+\/edit\/?$/,
];

function normalizePathname(pathname = '') {
  const normalizedPath = String(pathname || '/').startsWith('/')
    ? String(pathname || '/')
    : `/${String(pathname || '/')}`;

  return normalizedPath === '/' ? normalizedPath : normalizedPath.replace(/\/+$/, '');
}

function getSecondPathSegment(pathname) {
  return normalizePathname(pathname).split('/').filter(Boolean)[1] || '';
}

function isSingleChildPath(pathname, parentPath) {
  const normalizedPath = normalizePathname(pathname);

  if (!normalizedPath.startsWith(`${parentPath}/`)) {
    return false;
  }

  return normalizedPath.split('/').filter(Boolean).length === 2;
}

export function isPublicLegacyPath(pathname = '') {
  const normalizedPath = normalizePathname(pathname);

  if (PUBLIC_EXACT_PATHS.has(normalizedPath)) {
    return true;
  }

  if (isSingleChildPath(normalizedPath, '/products')) {
    return !PRODUCT_RESERVED_SEGMENTS.has(getSecondPathSegment(normalizedPath));
  }

  if (isSingleChildPath(normalizedPath, '/blog')) {
    return !BLOG_RESERVED_SEGMENTS.has(getSecondPathSegment(normalizedPath));
  }

  if (isSingleChildPath(normalizedPath, '/gifts')) {
    return !GIFT_RESERVED_SEGMENTS.has(getSecondPathSegment(normalizedPath));
  }

  return false;
}

function buildLocaleRedirect({
  pathname,
  search = '',
  status,
  noStore = false,
  varyLocalePreference = false,
}) {
  const headers = {};

  if (noStore) {
    headers['Cache-Control'] = 'private, max-age=0, no-store';
  }

  if (varyLocalePreference) {
    headers.Vary = [
      'Cookie',
      'CF-IPCountry',
      'X-Vercel-IP-Country',
      'CloudFront-Viewer-Country',
    ].join(', ');
  }

  if (new URLSearchParams(String(search || '').replace(/^\?/, '')).has(TOKEN_QUERY_PARAM)) {
    headers['Cache-Control'] = 'private, max-age=0, no-store';
    headers['Referrer-Policy'] = 'no-referrer';
  }

  return {
    pathname,
    search,
    status,
    headers,
  };
}

export function resolvePublicLocaleRedirect({
  pathname = '/',
  search = '',
  localeRoutingEnabled = isLocaleRoutingEnabled(),
  englishEnabled = isEnglishPublicLocaleEnabled(),
  savedLocale = '',
  countryCode = '',
} = {}) {
  if (!localeRoutingEnabled) {
    const normalizedPath = normalizePathname(pathname);
    const explicitLocale = getPathLocale(normalizedPath);

    if (explicitLocale) {
      return buildLocaleRedirect({
        pathname: stripPathLocale(normalizedPath),
        search: filterPublicSearchParams(search, {}, { includeToken: true }),
        status: 307,
        noStore: true,
      });
    }

    return null;
  }

  const normalizedPath = normalizePathname(pathname);
  const enabledLocales = getEnabledPublicLocales({ englishEnabled });
  const explicitLocale = getPathLocale(normalizedPath);

  if (explicitLocale) {
    const unlocalizedPath = stripPathLocale(normalizedPath);

    if (enabledLocales.includes(explicitLocale)) {
      if (unlocalizedPath === '/' || isPublicLegacyPath(unlocalizedPath)) {
        return null;
      }

      return buildLocaleRedirect({
        pathname: unlocalizedPath,
        search: filterPublicSearchParams(search, {}, { includeToken: true }),
        status: 307,
        noStore: true,
      });
    }

    if (explicitLocale === 'en') {
      const targetBasePath = unlocalizedPath === '/' || isPublicLegacyPath(unlocalizedPath)
        ? localizePath(unlocalizedPath, DEFAULT_LOCALE)
        : unlocalizedPath;

      return buildLocaleRedirect({
        pathname: targetBasePath,
        search: filterPublicSearchParams(
          search,
          { [ENGLISH_UNAVAILABLE_NOTICE_QUERY]: ENGLISH_UNAVAILABLE_NOTICE_VALUE },
          { includeToken: true }
        ),
        status: 307,
        noStore: true,
      });
    }

    return null;
  }

  if (normalizedPath === '/') {
    const preferredLocale = enabledLocales.includes(String(savedLocale || '').trim().toLowerCase())
      ? String(savedLocale).trim().toLowerCase()
      : selectLocaleForCountry(countryCode, { enabledLocales });

    return buildLocaleRedirect({
      pathname: `/${preferredLocale}`,
      search: filterPublicSearchParams(search, {}, { includeToken: true }),
      status: 307,
      noStore: true,
      varyLocalePreference: true,
    });
  }

  if (isPublicLegacyPath(normalizedPath)) {
    const isTokenPage = isNewsletterTokenPagePath(normalizedPath);

    return buildLocaleRedirect({
      pathname: localizePath(normalizedPath, DEFAULT_LOCALE),
      search: filterPublicSearchParams(search, {}, { includeToken: true }),
      status: isTokenPage ? 307 : 308,
      noStore: isTokenPage,
    });
  }

  return null;
}

export function isProtectedPagePath(pathname = '') {
  const normalizedPath = stripPathLocale(pathname === '/' ? pathname : pathname.replace(/\/+$/, ''));

  return (
    PROTECTED_PAGE_PREFIXES.some((prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)) ||
    PROTECTED_PAGE_PATTERNS.some((pattern) => pattern.test(normalizedPath))
  );
}

function getEnabledPathLocale(pathname) {
  if (!isLocaleRoutingEnabled()) {
    return '';
  }

  const pathLocale = getPathLocale(pathname);

  return isEnabledPublicLocale(pathLocale) ? pathLocale : '';
}

function isNewsletterTokenPagePath(pathname = '') {
  return NEWSLETTER_TOKEN_PAGE_PATHS.has(stripPathLocale(normalizePathname(pathname)));
}

function buildNextResponse(request) {
  const pathLocale = getEnabledPathLocale(request.nextUrl.pathname);
  const isTokenPage = isNewsletterTokenPagePath(request.nextUrl.pathname);
  let response;

  if (!pathLocale) {
    response = NextResponse.next();
  } else {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(LOCALE_REQUEST_HEADER, pathLocale);

    response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  if (isTokenPage) {
    response.headers.set('Cache-Control', 'private, max-age=0, no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
  }

  return response;
}

export function middleware(request) {
  const { pathname, search } = request.nextUrl;
  const localeRedirect = resolvePublicLocaleRedirect({
    pathname,
    search,
    savedLocale: request.cookies.get(LOCALE_COOKIE_NAME)?.value,
    countryCode: getRequestCountryCode(request.headers),
  });

  if (localeRedirect) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = localeRedirect.pathname;
    redirectUrl.search = localeRedirect.search;

    const response = NextResponse.redirect(redirectUrl, localeRedirect.status);

    for (const [key, value] of Object.entries(localeRedirect.headers)) {
      response.headers.set(key, value);
    }

    return response;
  }

  if (!isProtectedPagePath(pathname) || request.cookies.has(AUTH_COOKIE_NAME)) {
    return buildNextResponse(request);
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/users/login';
  loginUrl.search = '';
  loginUrl.searchParams.set('redirect', stripPathLocale(`${pathname}${search}`));

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    '/',
    '/aboutus/:path*',
    '/blog/create/:path*',
    '/blog/:path*',
    '/bg/:path*',
    '/blog/:path*/edit',
    '/categories/:path*',
    '/cartoons/:path*',
    '/contacts/:path*',
    '/en/:path*',
    '/faq/:path*',
    '/gifts/:path*',
    '/home-banners/create/:path*',
    '/home-banners/:path*/edit',
    '/homepage-featured/:path*',
    '/newsletter/confirm/:path*',
    '/newsletter/preferences/:path*',
    '/newsletter/unsubscribe/:path*',
    '/newsletter/send/:path*',
    '/partners/:path*',
    '/products/create/:path*',
    '/products/:path*',
    '/products/:path*/delete',
    '/products/:path*/edit',
    '/search/:path*',
    '/translations/:path*',
    '/users',
  ],
};
