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

const PROD_SITE_URL = 'https://happycolors.eu';
const LOCAL_URL = 'http://localhost:3000';
const RENDER_PREVIEW_BRANCH = 'single-deploy-refactor';
export const SITE_OG_IMAGE_PATH = '/lion_banner.webp';

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
