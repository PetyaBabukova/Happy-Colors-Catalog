import { createRevalidateSurfaceHelpers } from './revalidateSurfaces.js';

const { revalidateSurfaces, revalidateSurfacesSafely } = createRevalidateSurfaceHelpers({
  surfaceName: 'blog',
  endpointPath: '/api/revalidate/blog',
  urlEnvNames: ['BLOG_REVALIDATE_URLS', 'BLOG_REVALIDATE_URL'],
  secretEnvNames: ['BLOG_REVALIDATE_SECRET', 'REVALIDATE_SECRET'],
  buildBody: ({ articleId } = {}) => ({ articleId: String(articleId) }),
  shouldSkip: ({ articleId } = {}) => !articleId,
  missingConfigurationMessage: 'Blog revalidation is not configured.',
});

export const revalidateBlogSurfaces = revalidateSurfaces;
export const revalidateBlogSurfacesSafely = revalidateSurfacesSafely;
