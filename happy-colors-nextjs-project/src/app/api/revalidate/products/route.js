import { revalidatePath, revalidateTag } from 'next/cache';

import { revalidateLocalizedPath } from '../_lib/localizedPaths';
import { createRevalidatePostHandler, isValidObjectId } from '../_lib/revalidateRoute';

function validatePayload(body) {
  const hasProductId = Object.prototype.hasOwnProperty.call(body || {}, 'productId');
  const productId = hasProductId && typeof body?.productId === 'string' ? body.productId.trim() : '';

  if (
    hasProductId &&
    body?.productId !== null &&
    body?.productId !== '' &&
    (typeof body?.productId !== 'string' || !isValidObjectId(productId))
  ) {
    return { ok: false, message: 'Invalid productId.' };
  }

  return { ok: true, value: { productId } };
}

function revalidateProductSurfaces({ productId } = {}) {
  revalidateTag('products');
  revalidateTag('categories');
  revalidateTag('visible-categories');
  revalidateTag('homepage-featured-products');
  revalidateTag('cartoon-gallery-products');
  revalidateLocalizedPath('/products');
  revalidateLocalizedPath('/');
  revalidateLocalizedPath('/cartoons');
  revalidatePath('/sitemap.xml');

  if (productId) {
    revalidateLocalizedPath(`/products/${productId}`);
  }
}

export const POST = createRevalidatePostHandler({
  routeLabel: '/api/revalidate/products',
  secretEnvNames: ['PRODUCT_REVALIDATE_SECRET', 'REVALIDATE_SECRET'],
  allowInvalidJson: true,
  validatePayload,
  revalidate: revalidateProductSurfaces,
  errorMessage: 'Р“СЂРµС€РєР° РїСЂРё РѕР±РЅРѕРІСЏРІР°РЅРµ РЅР° РєРµС€Р° РЅР° РїСЂРѕРґСѓРєС‚РёС‚Рµ.',
});
