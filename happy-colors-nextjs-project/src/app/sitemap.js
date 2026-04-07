// src/app/sitemap.js

import {
  PROD_SITE_URL,
  shouldExposeSitemap,
} from '@/config/siteSeo';
import baseURL from '@/config';

export const revalidate = 3600;

export default async function sitemap() {
  if (!shouldExposeSitemap) {
    return [];
  }

  const now = new Date();

  let productEntries = [];

  try {
    const res = await fetch(`${baseURL}/products`, {
      next: { revalidate: 3600 },
    });

    if (res.ok) {
      const products = await res.json();

      if (Array.isArray(products)) {
        productEntries = products
          .filter((product) => product?._id)
          .map((product) => ({
            url: `${PROD_SITE_URL}/products/${product._id}`,
            lastModified: new Date(
              product.updatedAt || product.createdAt || now
            ),
            changeFrequency: 'weekly',
            priority: 0.8,
          }));
      }
    }
  } catch (error) {
    console.error('Грешка при генериране на sitemap за продуктите:', error);
  }

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
    {
      url: `${PROD_SITE_URL}/aboutus`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${PROD_SITE_URL}/contacts`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    ...productEntries,
  ];
}
