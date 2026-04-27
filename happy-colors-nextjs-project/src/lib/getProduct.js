import { cache } from 'react';

import baseURL from '@/config';
import { readResponseJsonSafely } from '@/utils/errorHandler';

export const getProduct = cache(async (productId) => {
  try {
    const res = await fetch(`${baseURL}/products/${productId}`, {
      cache: 'no-store',
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
