import baseURL from '@/config';
import { isOwner } from './isOwner';
import { readResponseJsonSafely } from './errorHandler';

export async function checkProductAccess(productId, user) {
  try {
    const res = await fetch(`${baseURL}/products/mine/${productId}`, {
      cache: 'no-store',
      credentials: 'include',
    });

    if (!res.ok) {
      return { product: null, unauthorized: true };
    }

    const product = await readResponseJsonSafely(res);

    if (!product) {
      return { product: null, unauthorized: false, error: true };
    }

    if (!user || !isOwner(product, user)) {
      return { product, unauthorized: true };
    }

    return { product, unauthorized: false };
  } catch {
    return { product: null, unauthorized: false, error: true };
  }
}
