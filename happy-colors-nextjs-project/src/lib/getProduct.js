import { cache } from 'react';
import { cookies } from 'next/headers';

import baseURL from '@/config';
import { readResponseJsonSafely } from '@/utils/errorHandler';

export const getProduct = cache(async (productId) => {
  try {
    const cookieHeader = (await cookies()).toString();
    const res = await fetch(`${baseURL}/products/${productId}`, {
      cache: 'no-store',
      headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
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
