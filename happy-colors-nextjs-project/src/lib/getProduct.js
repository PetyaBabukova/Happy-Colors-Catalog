import { cache } from 'react';

import baseURL from '@/config';

export const PRODUCT_REVALIDATE_SECONDS = 60;

export const getProduct = cache(async (productId) => {
  const res = await fetch(`${baseURL}/products/${productId}`, {
    next: { revalidate: PRODUCT_REVALIDATE_SECONDS },
  });

  if (!res.ok) {
    return null;
  }

  return res.json();
});
