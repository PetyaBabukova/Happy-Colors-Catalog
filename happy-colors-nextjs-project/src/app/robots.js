// src/app/robots.js

import {
  PROD_SITE_URL,
  currentSiteUrl,
  shouldExposeSitemap,
  shouldIndexSite,
} from '@/config/siteSeo';

const AI_SEARCH_CRAWLERS = ['OAI-SearchBot', 'ChatGPT-User'];
const PRIVATE_PRODUCTION_DISALLOW_PATHS = [
  '/analytics',
  '/api/',
  '/cart',
  '/cartoon-orders',
  '/categories',
  '/checkout',
  '/home-banners',
  '/homepage-featured',
  '/newsletter',
  '/products/create',
  '/products/*/delete',
  '/products/*/edit',
  '/translations',
  '/users',
];

function buildProductionRule(userAgent) {
  return {
    userAgent,
    allow: '/',
    disallow: PRIVATE_PRODUCTION_DISALLOW_PATHS,
  };
}

export default function robots() {
  const rules = shouldIndexSite
    ? [
        buildProductionRule('*'),
        ...AI_SEARCH_CRAWLERS.map(buildProductionRule),
      ]
    : {
        userAgent: '*',
        disallow: '/',
      };

  return {
    rules,
    host: shouldIndexSite ? PROD_SITE_URL : currentSiteUrl,
    ...(shouldExposeSitemap
      ? {
          sitemap: `${PROD_SITE_URL}/sitemap.xml`,
        }
      : {}),
  };
}
