import { cache } from 'react';

import baseURL from '@/config';
import { readResponseJsonSafely } from '@/utils/errorHandler';

export const PRODUCT_REVALIDATE_SECONDS = 60;

export const getProduct = cache(async (productId) => {
  try {
    const res = await fetch(`${baseURL}/products/${productId}`, {
      next: {
        revalidate: PRODUCT_REVALIDATE_SECONDS,
        tags: ['products', `product-${productId}`],
      },
    });

    if (!res.ok) {
      return null;
    }

    const product = await readResponseJsonSafely(res);

    if (!product || typeof product !== 'object') {
      return null;
    }

    return product;
  } catch (error) {
    console.error(`Грешка при зареждане на продукт ${productId}:`, error);
    return null;
  }
});
