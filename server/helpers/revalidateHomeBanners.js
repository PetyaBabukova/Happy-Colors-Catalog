import { createRevalidateSurfaceHelpers } from './revalidateSurfaces.js';

const { revalidateSurfaces, revalidateSurfacesSafely } = createRevalidateSurfaceHelpers({
  surfaceName: 'home-banner',
  endpointPath: '/api/revalidate/home-banners',
  urlEnvNames: ['HOME_BANNER_REVALIDATE_URLS', 'HOME_BANNER_REVALIDATE_URL'],
  secretEnvNames: ['HOME_BANNER_REVALIDATE_SECRET', 'REVALIDATE_SECRET'],
  missingConfigurationMessage: 'Home banner revalidation is not configured.',
});

export const revalidateHomeBannerSurfaces = revalidateSurfaces;
export const revalidateHomeBannerSurfacesSafely = revalidateSurfacesSafely;
