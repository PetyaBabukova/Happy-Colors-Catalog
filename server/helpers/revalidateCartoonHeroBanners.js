import { createRevalidateSurfaceHelpers } from './revalidateSurfaces.js';

const { revalidateSurfaces, revalidateSurfacesSafely } = createRevalidateSurfaceHelpers({
  surfaceName: 'cartoon-hero-banner',
  endpointPath: '/api/revalidate/cartoon-hero-banners',
  urlEnvNames: ['CARTOON_HERO_BANNER_REVALIDATE_URLS', 'CARTOON_HERO_BANNER_REVALIDATE_URL'],
  secretEnvNames: ['CARTOON_HERO_BANNER_REVALIDATE_SECRET', 'REVALIDATE_SECRET'],
  missingConfigurationMessage: 'Cartoon hero banner revalidation is not configured.',
});

export const revalidateCartoonHeroBannerSurfaces = revalidateSurfaces;
export const revalidateCartoonHeroBannerSurfacesSafely = revalidateSurfacesSafely;
