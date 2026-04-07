// src/app/robots.js

import {
  PROD_SITE_URL,
  currentSiteUrl,
  shouldExposeSitemap,
  shouldIndexSite,
} from '@/config/siteSeo';

export default function robots() {
  return {
    rules: {
      userAgent: '*',
      ...(shouldIndexSite ? { allow: '/' } : { disallow: '/' }),
    },
    host: shouldIndexSite ? PROD_SITE_URL : currentSiteUrl,
    ...(shouldExposeSitemap
      ? {
          sitemap: `${PROD_SITE_URL}/sitemap.xml`,
        }
      : {}),
  };
}
