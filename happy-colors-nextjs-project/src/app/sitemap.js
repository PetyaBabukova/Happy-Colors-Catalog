// src/app/sitemap.js

import {
  PROD_SITE_URL,
  shouldExposeSitemap,
} from '@/config/siteSeo';
import { isCartoonsServiceEnabled } from '@/config/cartoonsFeature';
import { GIFT_GUIDE_SLUGS, GIFT_HUB_PATH } from '@/content/publicPages/gifts';
import {
  DEFAULT_LOCALE,
  getEnabledPublicLocales,
  isLocaleRoutingEnabled,
} from '@/i18n/config';
import { localizePath } from '@/i18n/routing';

export const revalidate = 3600;

const PRODUCTS_API_URL = `${PROD_SITE_URL}/api/products`;
const CATEGORY_REDIRECTS_API_URL = `${PROD_SITE_URL}/api/categories/visible/redirects`;
const BLOG_API_URL = `${PROD_SITE_URL}/api/blog-articles`;
const TARGET_LOCALE = 'en';
const CATEGORY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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

async function fetchSitemapEntries(apiUrl, tags, buildEntry, errorMessage) {
  const fetchTags = Array.isArray(tags) ? tags : [tags];

  try {
    const res = await fetch(apiUrl, {
      next: { revalidate: 3600, tags: fetchTags },
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
      ? [
          ['/cartoons', { changeFrequency: 'weekly', priority: 0.8 }],
          ['/cartoons/offer', { changeFrequency: 'monthly', priority: 0.7 }],
        ]
      : []),
    ['/aboutus', { changeFrequency: 'monthly', priority: 0.7 }],
    ['/faq', { changeFrequency: 'monthly', priority: 0.6 }],
    [GIFT_HUB_PATH, { changeFrequency: 'monthly', priority: 0.75 }],
    ...GIFT_GUIDE_SLUGS.map((slug) => [
      `${GIFT_HUB_PATH}/${slug}`,
      { changeFrequency: 'monthly', priority: 0.7 },
    ]),
    ['/blog', { changeFrequency: 'weekly', priority: 0.7 }],
    ['/contacts', { changeFrequency: 'monthly', priority: 0.7 }],
    ['/partners', { changeFrequency: 'monthly', priority: 0.6 }],
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

function getCategoryCanonicalSlug(category) {
  return String(category?.canonicalSlug || category?.filterSlug || '').trim();
}

function getEligibleCategoryLocales(category) {
  return Array.isArray(category?.eligibleLocales) && category.eligibleLocales.length > 0
    ? category.eligibleLocales
    : [DEFAULT_LOCALE];
}

function canIncludeCategoryInSitemap(category) {
  const canonicalSlug = getCategoryCanonicalSlug(category);

  return Boolean(category?.canonicalSlugReviewed) && CATEGORY_SLUG_PATTERN.test(canonicalSlug);
}

function buildCategoryEntries(category, now) {
  if (!canIncludeCategoryInSitemap(category)) {
    return [];
  }

  const canonicalSlug = getCategoryCanonicalSlug(category);
  const item = {
    ...category,
    availableLocales: getEligibleCategoryLocales(category),
  };

  return buildDynamicEntries(item, `/products?category=${encodeURIComponent(canonicalSlug)}`, {
    lastModified: new Date(category.updatedAt || category.createdAt || now),
    changeFrequency: 'daily',
    priority: 0.75,
  });
}

export default async function sitemap() {
  if (!shouldExposeSitemap) {
    return [];
  }

  const now = new Date();

  const [productEntries, categoryEntries, blogEntries] = await Promise.all([
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
      CATEGORY_REDIRECTS_API_URL,
      ['categories', 'products'],
      (category) => buildCategoryEntries(category, now),
      'Error generating category sitemap entries:'
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
    ...categoryEntries,
    ...blogEntries,
  ];
}
