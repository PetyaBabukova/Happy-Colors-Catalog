// src/app/sitemap.js

import {
  PROD_SITE_URL,
  shouldExposeSitemap,
} from '@/config/siteSeo';
import { isCartoonsServiceEnabled } from '@/config/cartoonsFeature';

export const revalidate = 3600;

const PRODUCTS_API_URL = `${PROD_SITE_URL}/api/products`;
const BLOG_API_URL = `${PROD_SITE_URL}/api/blog-articles`;

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

    return items.filter((item) => item?._id).map(buildEntry);
  } catch (error) {
    console.error(errorMessage, error);
    return [];
  }
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
      (product) => ({
        url: `${PROD_SITE_URL}/products/${product._id}`,
        lastModified: new Date(product.updatedAt || product.createdAt || now),
        changeFrequency: 'weekly',
        priority: 0.8,
      }),
      'Грешка при генериране на sitemap за продуктите:'
    ),
    fetchSitemapEntries(
      BLOG_API_URL,
      'blog-articles',
      (article) => ({
        url: `${PROD_SITE_URL}/blog/${article._id}`,
        lastModified: new Date(article.updatedAt || article.publishedAt || article.createdAt || now),
        changeFrequency: 'monthly',
        priority: 0.65,
      }),
      'Грешка при генериране на sitemap за блога:'
    ),
  ]);

  return [
    {
      url: `${PROD_SITE_URL}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${PROD_SITE_URL}/products`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    ...(isCartoonsServiceEnabled
      ? [
          {
            url: `${PROD_SITE_URL}/cartoons`,
            lastModified: now,
            changeFrequency: 'weekly',
            priority: 0.8,
          },
        ]
      : []),
    {
      url: `${PROD_SITE_URL}/aboutus`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${PROD_SITE_URL}/faq`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${PROD_SITE_URL}/blog`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${PROD_SITE_URL}/contacts`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    ...productEntries,
    ...blogEntries,
  ];
}
