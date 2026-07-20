// src/config/siteSeo.js

import {
  DEFAULT_LOCALE,
  isLocaleRoutingEnabled,
  isSupportedLocale,
  normalizeLocale,
} from '@/i18n/config';
import { localizePath } from '@/i18n/routing';

const PROD_SITE_URL = 'https://happycolors.eu';
const LOCAL_URL = 'http://localhost:3000';
const RENDER_PREVIEW_BRANCH = 'single-deploy-refactor';
export const SITE_OG_IMAGE_PATH = '/og/happy-colors-og.png';

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

export function getLocalizedCanonicalPath(path, locale = DEFAULT_LOCALE) {
  const requestedLocale = normalizeLocale(locale || DEFAULT_LOCALE);
  const normalizedLocale = isSupportedLocale(requestedLocale) ? requestedLocale : DEFAULT_LOCALE;
  const normalizedPath = String(path || '/').startsWith('/')
    ? String(path || '/')
    : `/${String(path || '/')}`;

  if (isLocaleRoutingEnabled()) {
    return localizePath(normalizedPath, normalizedLocale);
  }

  return normalizedLocale === DEFAULT_LOCALE
    ? normalizedPath
    : localizePath(normalizedPath, normalizedLocale);
}

export function buildPageMetadata({
  title,
  description,
  path,
  locale = DEFAULT_LOCALE,
  indexable = true,
}) {
  const canIndexThisPage = shouldIndexSite && indexable;

  return {
    title,
    description,
    robots: {
      index: canIndexThisPage,
      follow: canIndexThisPage,
    },
    ...(canIndexThisPage && path
      ? {
          alternates: {
            canonical: getLocalizedCanonicalPath(path, locale),
          },
        }
      : {}),
  };
}
