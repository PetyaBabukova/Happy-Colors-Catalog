// src/config/siteSeo.js

import {
  DEFAULT_LOCALE,
  getEnabledPublicLocales,
  isLocaleRoutingEnabled,
  isSupportedLocale,
  LOCALE_DETAILS,
  normalizeLocale,
} from '@/i18n/config';
import { localizePath } from '@/i18n/routing';
import { getVerifiedSameAsUrls } from '@/config/publicSocialProfiles';

const PROD_SITE_URL = 'https://happycolors.eu';
const LOCAL_URL = 'http://localhost:3000';
const RENDER_PREVIEW_BRANCH = 'single-deploy-refactor';
export const SITE_OG_IMAGE_PATH = '/lion_banner.webp';
export const ORGANIZATION_SCHEMA_ID = `${PROD_SITE_URL}/#organization`;
export const WEBSITE_SCHEMA_ID = `${PROD_SITE_URL}/#website`;
export const HAPPY_COLORS_ALTERNATE_NAMES = ['Хепи Колорс', 'Хепи Калърс'];

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

function resolveSiteEnv() {
  if (process.env.NEXT_PUBLIC_SITE_ENV) {
    return process.env.NEXT_PUBLIC_SITE_ENV;
  }

  const branchName = process.env.RENDER_GIT_BRANCH;

  if (branchName === 'main') {
    return 'production';
  }

  if (branchName === RENDER_PREVIEW_BRANCH) {
    return 'preview';
  }

  return 'development';
}

export const SITE_ENV = resolveSiteEnv();
export const IS_PULL_REQUEST_PREVIEW =
  process.env.IS_PULL_REQUEST === 'true';
export const IS_RENDER_PREVIEW_BRANCH =
  process.env.RENDER_GIT_BRANCH === RENDER_PREVIEW_BRANCH;

export const isProductionSite = SITE_ENV === 'production';
export const isPreviewSite =
  SITE_ENV === 'preview' ||
  IS_PULL_REQUEST_PREVIEW ||
  IS_RENDER_PREVIEW_BRANCH;

export const currentSiteUrl = stripTrailingSlash(
  process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    (isProductionSite ? PROD_SITE_URL : LOCAL_URL)
);

export const shouldIndexSite =
  isProductionSite &&
  !isPreviewSite &&
  currentSiteUrl === PROD_SITE_URL;
export const shouldExposeSitemap = shouldIndexSite;

export const metadataBaseUrl = new URL(
  shouldIndexSite ? PROD_SITE_URL : currentSiteUrl
);

export { PROD_SITE_URL };

const PRODUCTION_SITE_HOSTNAME = new URL(PROD_SITE_URL).hostname;

function isLocalStructuredDataHostname(hostname) {
  const normalizedHostname = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');

  return (
    normalizedHostname === 'localhost' ||
    normalizedHostname === '0.0.0.0' ||
    normalizedHostname === '::1' ||
    normalizedHostname.startsWith('127.') ||
    normalizedHostname.endsWith('.local') ||
    normalizedHostname.endsWith('.localhost')
  );
}

export function isUnsafeStructuredDataUrl(value) {
  if (!value || typeof value !== 'string') {
    return false;
  }

  try {
    const parsedUrl = new URL(value);
    const hostname = parsedUrl.hostname.toLowerCase();

    // Deny known non-production hosts while still allowing legitimate third-party asset URLs.
    return (
      parsedUrl.protocol !== 'http:' &&
      parsedUrl.protocol !== 'https:'
    ) || (
      hostname !== PRODUCTION_SITE_HOSTNAME &&
      (
        isLocalStructuredDataHostname(hostname) ||
        hostname.includes('preview') ||
        hostname.endsWith('.onrender.com') ||
        hostname.endsWith('.vercel.app') ||
        hostname.endsWith('.netlify.app')
      )
    );
  } catch {
    return false;
  }
}

export function buildStructuredDataUrl(value = '/', { fallbackPath = '/' } = {}) {
  const normalizedValue = String(value || fallbackPath || '/').trim();

  try {
    const parsedUrl = new URL(normalizedValue, PROD_SITE_URL);

    if (isUnsafeStructuredDataUrl(parsedUrl.toString())) {
      return new URL(
        `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`,
        PROD_SITE_URL
      ).toString();
    }

    return parsedUrl.toString();
  } catch {
    return new URL(fallbackPath || '/', PROD_SITE_URL).toString();
  }
}

export function buildStructuredDataId(path = '/', fragment = '') {
  const url = buildStructuredDataUrl(path);
  const normalizedFragment = String(fragment || '').replace(/^#+/, '');

  return normalizedFragment ? `${url}#${normalizedFragment}` : url;
}

export function getOrganizationReference() {
  return {
    '@type': 'Organization',
    '@id': ORGANIZATION_SCHEMA_ID,
    name: 'Happy Colors',
    alternateName: HAPPY_COLORS_ALTERNATE_NAMES,
  };
}

export function getOrganizationLogoSchema() {
  return {
    '@type': 'ImageObject',
    url: buildStructuredDataUrl('/logo_64pxH.svg'),
  };
}

export function buildOrganizationJsonLd() {
  const sameAs = getVerifiedSameAsUrls();

  return {
    '@context': 'https://schema.org',
    ...getOrganizationReference(),
    url: buildStructuredDataUrl('/'),
    logo: getOrganizationLogoSchema(),
    ...(sameAs.length ? { sameAs } : {}),
  };
}

export function buildWebsiteJsonLd(locale = DEFAULT_LOCALE) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': WEBSITE_SCHEMA_ID,
    name: 'Happy Colors',
    alternateName: HAPPY_COLORS_ALTERNATE_NAMES,
    url: buildStructuredDataUrl('/'),
    publisher: {
      '@id': ORGANIZATION_SCHEMA_ID,
    },
    inLanguage: getStructuredDataLanguage(locale),
  };
}

export function getStructuredDataLanguage(locale = DEFAULT_LOCALE) {
  return LOCALE_DETAILS[getMetadataLocale(locale)].intlLocale;
}

export function buildBreadcrumbListJsonLd(items = []) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items
      .filter((item) => item?.name && item?.path)
      .map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: buildStructuredDataUrl(item.path),
      })),
  };
}

function normalizeCanonicalPath(path) {
  const normalizedPath = String(path || '/');

  return normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
}

export function getLocalizedCanonicalPath(path, locale = DEFAULT_LOCALE) {
  const requestedLocale = normalizeLocale(locale || DEFAULT_LOCALE);
  const normalizedLocale = isSupportedLocale(requestedLocale) ? requestedLocale : DEFAULT_LOCALE;
  const normalizedPath = normalizeCanonicalPath(path);

  if (isLocaleRoutingEnabled()) {
    return localizePath(normalizedPath, normalizedLocale);
  }

  return normalizedLocale === DEFAULT_LOCALE
    ? normalizedPath
    : localizePath(normalizedPath, normalizedLocale);
}

export function buildLocalizedLanguageAlternates(path, {
  enabledLocales = getEnabledPublicLocales(),
  includeXDefault = true,
} = {}) {
  const normalizedPath = normalizeCanonicalPath(path);
  const publicEnabledLocales = new Set(getEnabledPublicLocales());
  const languages = {};

  for (const locale of enabledLocales) {
    const normalizedLocale = normalizeLocale(locale);

    if (isSupportedLocale(normalizedLocale) && publicEnabledLocales.has(normalizedLocale)) {
      languages[normalizedLocale] = getLocalizedCanonicalPath(normalizedPath, normalizedLocale);
    }
  }

  if (includeXDefault) {
    languages['x-default'] = getLocalizedCanonicalPath(normalizedPath, DEFAULT_LOCALE);
  }

  return languages;
}

export function buildLocalizedAlternates(path, locale = DEFAULT_LOCALE, options = {}) {
  return {
    canonical: getLocalizedCanonicalPath(path, locale),
    languages: buildLocalizedLanguageAlternates(path, options),
  };
}

function getMetadataLocale(locale = DEFAULT_LOCALE) {
  const normalizedLocale = normalizeLocale(locale);

  return isSupportedLocale(normalizedLocale) ? normalizedLocale : DEFAULT_LOCALE;
}

function getMetadataTitleText(title) {
  if (typeof title === 'string') {
    return title;
  }

  return title?.absolute || title?.default || 'Happy Colors';
}

export function getOpenGraphLocale(locale = DEFAULT_LOCALE) {
  return LOCALE_DETAILS[getMetadataLocale(locale)].intlLocale.replace('-', '_');
}

export function getOpenGraphAlternateLocales(locale = DEFAULT_LOCALE, {
  enabledLocales = getEnabledPublicLocales(),
} = {}) {
  const currentLocale = getMetadataLocale(locale);
  const publicEnabledLocales = new Set(getEnabledPublicLocales());

  return enabledLocales
    .map(getMetadataLocale)
    .filter((candidate, index, locales) => (
      candidate !== currentLocale &&
      publicEnabledLocales.has(candidate) &&
      locales.indexOf(candidate) === index
    ))
    .map(getOpenGraphLocale);
}

export function buildPageMetadata({
  title,
  description,
  path,
  locale = DEFAULT_LOCALE,
  indexable = true,
  image = SITE_OG_IMAGE_PATH,
  imageAlt,
}) {
  const canIndexThisPage = shouldIndexSite && indexable;
  const titleText = getMetadataTitleText(title);
  const alternateLocale = getOpenGraphAlternateLocales(locale);
  const canonicalPath = path ? getLocalizedCanonicalPath(path, locale) : '';

  return {
    title,
    description,
    robots: {
      index: canIndexThisPage,
      follow: canIndexThisPage,
    },
    ...(canIndexThisPage && path
      ? {
          alternates: buildLocalizedAlternates(path, locale),
          openGraph: {
            title: titleText,
            description,
            type: 'website',
            url: canonicalPath,
            siteName: 'Happy Colors',
            locale: getOpenGraphLocale(locale),
            ...(alternateLocale.length ? { alternateLocale } : {}),
            images: [
              {
                url: image,
                alt: imageAlt || titleText,
              },
            ],
          },
          twitter: {
            card: 'summary_large_image',
            title: titleText,
            description,
            images: [image],
          },
        }
      : {}),
  };
}
