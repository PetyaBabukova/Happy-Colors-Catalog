import { getProduct } from '@/lib/getProduct';
import { getReleasedServiceContextFromSearchParams } from '@/config/cartoonsFeature';

async function fetchProduct(productId) {
  if (!productId) return null;

  try {
    return await getProduct(productId);
  } catch {
    return null;
  }
}

export async function resolveContactPageData(searchParams) {
  const params = await searchParams;
  const product = await fetchProduct(params?.productId);

  return {
    product,
    productId: params?.productId || null,
    serviceContext: getReleasedServiceContextFromSearchParams(params),
  };
}
