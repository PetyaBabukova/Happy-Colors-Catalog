// src/app/sitemap.js

import {
  PROD_SITE_URL,
  shouldExposeSitemap,
} from '@/config/siteSeo';
import { isCartoonsServiceEnabled } from '@/config/cartoonsFeature';
import {
  DEFAULT_LOCALE,
  getEnabledPublicLocales,
  isLocaleRoutingEnabled,
} from '@/i18n/config';
import { localizePath } from '@/i18n/routing';

export const revalidate = 3600;

const PRODUCTS_API_URL = `${PROD_SITE_URL}/api/products`;
const BLOG_API_URL = `${PROD_SITE_URL}/api/blog-articles`;
const TARGET_LOCALE = 'en';

function absoluteUrl(path) {
  return new URL(path, PROD_SITE_URL).toString();
}

function getSitemapLocales() {
  return isLocaleRoutingEnabled() ? getEnabledPublicLocales() : [DEFAULT_LOCALE];
}

function getSitemapPath(path, locale) {
  return isLocaleRoutingEnabled() ? localizePath(path, locale) : path;
}

function getEntryAvailableLocales(item) {
  return Array.isArray(item?.availableLocales) && item.availableLocales.length > 0
    ? item.availableLocales
    : [DEFAULT_LOCALE];
}

function canIncludeDynamicLocale(item, locale) {
  if (locale === DEFAULT_LOCALE) {
    return true;
  }

  return locale === TARGET_LOCALE && getEntryAvailableLocales(item).includes(TARGET_LOCALE);
}

function buildSitemapAlternates(path, locales) {
  if (!isLocaleRoutingEnabled()) {
    return undefined;
  }

  const languages = {};

  for (const locale of locales) {
    languages[locale] = absoluteUrl(localizePath(path, locale));
  }

  languages['x-default'] = absoluteUrl(localizePath(path, DEFAULT_LOCALE));

  return { languages };
}

function buildSitemapEntry(path, locale, locales, fields) {
  const alternates = buildSitemapAlternates(path, locales);

  return {
    url: absoluteUrl(getSitemapPath(path, locale)),
    ...fields,
    ...(alternates ? { alternates } : {}),
  };
}

async function fetchSitemapEntries(apiUrl, tag, buildEntry, errorMessage) {
  try {
    const res = await fetch(apiUrl, {
      next: { revalidate: 3600, tags: [tag] },
    });

    if (!res.ok) {
      return [];
    }

    const items = await res.json();

    if (!Array.isArray(items)) {
      return [];
    }

    return items.filter((item) => item?._id).flatMap(buildEntry);
  } catch (error) {
    console.error(errorMessage, error);
    return [];
  }
}

function buildStaticEntries(now) {
  const locales = getSitemapLocales();
  const staticPaths = [
    ['/', { changeFrequency: 'weekly', priority: 1 }],
    ['/products', { changeFrequency: 'daily', priority: 0.9 }],
    ...(isCartoonsServiceEnabled
      ? [['/cartoons', { changeFrequency: 'weekly', priority: 0.8 }]]
      : []),
    ['/aboutus', { changeFrequency: 'monthly', priority: 0.7 }],
    ['/faq', { changeFrequency: 'monthly', priority: 0.6 }],
    ['/blog', { changeFrequency: 'weekly', priority: 0.7 }],
    ['/contacts', { changeFrequency: 'monthly', priority: 0.7 }],
  ];

  return staticPaths.flatMap(([path, fields]) =>
    locales.map((locale) =>
      buildSitemapEntry(path, locale, locales, {
        lastModified: now,
        ...fields,
      })
    )
  );
}

function buildDynamicEntries(item, path, fields) {
  const locales = getSitemapLocales().filter((locale) => canIncludeDynamicLocale(item, locale));

  return locales.map((locale) => buildSitemapEntry(path, locale, locales, fields));
}

export default async function sitemap() {
  if (!shouldExposeSitemap) {
    return [];
  }

  const now = new Date();

  const [productEntries, blogEntries] = await Promise.all([
    fetchSitemapEntries(
      PRODUCTS_API_URL,
      'products',
      (product) =>
        buildDynamicEntries(product, `/products/${product._id}`, {
          lastModified: new Date(product.updatedAt || product.createdAt || now),
          changeFrequency: 'weekly',
          priority: 0.8,
        }),
      'Error generating product sitemap entries:'
    ),
    fetchSitemapEntries(
      BLOG_API_URL,
      'blog-articles',
      (article) =>
        buildDynamicEntries(article, `/blog/${article._id}`, {
          lastModified: new Date(article.updatedAt || article.publishedAt || article.createdAt || now),
          changeFrequency: 'monthly',
          priority: 0.65,
        }),
      'Error generating blog sitemap entries:'
    ),
  ]);

  return [
    ...buildStaticEntries(now),
    ...productEntries,
    ...blogEntries,
  ];
}
