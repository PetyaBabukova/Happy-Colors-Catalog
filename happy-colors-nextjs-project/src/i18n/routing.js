import {
  DEFAULT_LOCALE,
  getEnabledPublicLocales,
  isSupportedLocale,
  assertSupportedLocale,
} from './config';

const INTERNAL_URL_BASE = 'https://happycolors.local';
const LOCALE_PATH_PATTERN = /^\/([A-Za-z]{2})(?=\/|$)/;
const ABSOLUTE_OR_SCHEME_RELATIVE_PATTERN = /^(?:[A-Za-z][A-Za-z0-9+.-]*:|\/\/)/;
export const PUBLIC_QUERY_PARAM_ALLOWLIST = Object.freeze([
  'category',
  'created',
  'id',
  'productId',
  'q',
  'service',
  'source',
  'updated',
]);
const PUBLIC_QUERY_PARAM_ALLOWLIST_SET = new Set(PUBLIC_QUERY_PARAM_ALLOWLIST);
const TOKEN_QUERY_PARAM = 'token';

function normalizeEnabledLocales(enabledLocales) {
  const normalized = enabledLocales
    .map((locale) => String(locale).trim().toLowerCase())
    .filter((locale) => isSupportedLocale(locale));

  return normalized.length > 0 ? normalized : [DEFAULT_LOCALE];
}

function getDefaultEnabledLocale(enabledLocales) {
  return enabledLocales.includes(DEFAULT_LOCALE) ? DEFAULT_LOCALE : enabledLocales[0];
}

function parseInternalHref(href) {
  const rawHref = String(href || '/').trim() || '/';

  if (isExternalHref(rawHref)) {
    throw new Error(`External href cannot be localized: ${rawHref}`);
  }

  const normalizedHref = rawHref.startsWith('/') || rawHref.startsWith('?') || rawHref.startsWith('#')
    ? rawHref
    : `/${rawHref}`;
  const parsed = new URL(normalizedHref, INTERNAL_URL_BASE);

  return {
    pathname: parsed.pathname || '/',
    search: parsed.search,
    hash: parsed.hash,
  };
}

function stripLocaleFromPathname(pathname) {
  const normalizedPathname = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const match = normalizedPathname.match(LOCALE_PATH_PATTERN);

  if (!match || !isSupportedLocale(match[1])) {
    return normalizedPathname === '' ? '/' : normalizedPathname;
  }

  const strippedPathname = normalizedPathname.slice(match[0].length);

  return strippedPathname || '/';
}

export function isExternalHref(href) {
  return ABSOLUTE_OR_SCHEME_RELATIVE_PATTERN.test(String(href || '').trim());
}

export function getPathLocale(path) {
  const { pathname } = parseInternalHref(path);
  const match = pathname.match(LOCALE_PATH_PATTERN);

  return match && isSupportedLocale(match[1]) ? match[1].toLowerCase() : null;
}

export function stripPathLocale(path) {
  const { pathname, search, hash } = parseInternalHref(path);

  return `${stripLocaleFromPathname(pathname)}${search}${hash}`;
}

export function localizePath(path, locale) {
  const supportedLocale = assertSupportedLocale(locale);
  const { pathname, search, hash } = parseInternalHref(path);
  const strippedPathname = stripLocaleFromPathname(pathname);
  const suffix = strippedPathname === '/' ? '' : strippedPathname;

  return `/${supportedLocale}${suffix}${search}${hash}`;
}

export function replacePathLocale(path, locale) {
  return localizePath(path, locale);
}

export function localizeInternalHref(href, locale) {
  const rawHref = String(href || '/').trim() || '/';

  if (isExternalHref(rawHref)) {
    return rawHref;
  }

  return localizePath(rawHref, locale);
}

export function filterPublicSearchParams(search = '', extraParams = {}, { includeToken = false } = {}) {
  const sourceParams = new URLSearchParams(String(search || '').replace(/^\?/, ''));
  const targetParams = new URLSearchParams();

  for (const [key, value] of sourceParams.entries()) {
    if (PUBLIC_QUERY_PARAM_ALLOWLIST_SET.has(key) || (includeToken && key === TOKEN_QUERY_PARAM)) {
      targetParams.append(key, value);
    }
  }

  for (const [key, value] of Object.entries(extraParams)) {
    if (value !== undefined && value !== null && value !== '') {
      targetParams.set(key, String(value));
    }
  }

  const serialized = targetParams.toString();

  return serialized ? `?${serialized}` : '';
}

export function localizePublicHref(href, locale, { extraParams = {} } = {}) {
  const rawHref = String(href || '/').trim() || '/';

  if (isExternalHref(rawHref)) {
    return rawHref;
  }

  const { pathname, search, hash } = parseInternalHref(rawHref);
  const localizedPath = localizePath(pathname, locale);
  const filteredSearch = filterPublicSearchParams(search, extraParams);

  return `${localizedPath}${filteredSearch}${hash}`;
}

export function switchPublicLocaleHref(href, locale, options = {}) {
  return localizePublicHref(href, locale, options);
}

export function parseAcceptLanguage(header) {
  if (typeof header !== 'string' || header.trim() === '') {
    return [];
  }

  return header
    .split(',')
    .map((item, index) => {
      const [rawRange, ...params] = item.trim().split(';');
      const range = rawRange.trim().toLowerCase();

      if (!range || (!/^[a-z*][a-z0-9*-]*(?:-[a-z0-9*]+)*$/i.test(range))) {
        return null;
      }

      const qParam = params.find((param) => param.trim().toLowerCase().startsWith('q='));
      const q = qParam ? Number(qParam.split('=')[1]) : 1;

      if (!Number.isFinite(q) || q <= 0) {
        return null;
      }

      return {
        range,
        quality: Math.min(q, 1),
        index,
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.quality - left.quality || left.index - right.index);
}

function matchSupportedLocale(range, enabledLocales) {
  if (range === '*') {
    return getDefaultEnabledLocale(enabledLocales);
  }

  const primarySubtag = range.split('-')[0];

  return enabledLocales.includes(primarySubtag) ? primarySubtag : null;
}

export function negotiateLocale(acceptLanguageHeader, {
  enabledLocales = getEnabledPublicLocales(),
} = {}) {
  const normalizedEnabledLocales = normalizeEnabledLocales(enabledLocales);
  const parsedLanguages = parseAcceptLanguage(acceptLanguageHeader);

  if (parsedLanguages.length === 0) {
    return normalizedEnabledLocales.includes(DEFAULT_LOCALE)
      ? DEFAULT_LOCALE
      : normalizedEnabledLocales[0];
  }

  for (const language of parsedLanguages) {
    const matchedLocale = matchSupportedLocale(language.range, normalizedEnabledLocales);

    if (matchedLocale) {
      return matchedLocale;
    }
  }

  return getDefaultEnabledLocale(normalizedEnabledLocales);
}
