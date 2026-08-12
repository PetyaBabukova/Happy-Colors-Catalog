import { createRevalidateSurfaceHelpers } from './revalidateSurfaces.js';

const { revalidateSurfaces, revalidateSurfacesSafely } = createRevalidateSurfaceHelpers({
  surfaceName: 'product',
  endpointPath: '/api/revalidate/products',
  urlEnvNames: ['PRODUCT_REVALIDATE_URLS', 'PRODUCT_REVALIDATE_URL'],
  secretEnvNames: ['PRODUCT_REVALIDATE_SECRET', 'REVALIDATE_SECRET'],
  buildBody: ({ productId } = {}) => (productId ? { productId: String(productId) } : {}),
  missingConfigurationMessage: 'Product revalidation is not configured.',
});

export const revalidateProductSurfaces = revalidateSurfaces;
export const revalidateProductSurfacesSafely = revalidateSurfacesSafely;
