import { revalidatePath, revalidateTag } from 'next/cache';

import { revalidateLocalizedPath } from '../_lib/localizedPaths';
import {
  createMemoryRateLimiter,
  createRevalidatePostHandler,
  isValidObjectId,
} from '../_lib/revalidateRoute';

const blogRateLimiter = createMemoryRateLimiter({
  keyPrefix: 'blog-revalidate',
  windowMs: 10 * 60 * 1000,
  max: 60,
});

export function resetBlogRevalidateRateLimit() {
  blogRateLimiter.reset();
}

function validatePayload(payload) {
  const articleId = String(payload?.articleId || '').trim();

  if (!isValidObjectId(articleId)) {
    return { ok: false, message: 'РќРµРІР°Р»РёРґРµРЅ РёРґРµРЅС‚РёС„РёРєР°С‚РѕСЂ РЅР° Р±Р»РѕРі СЃС‚Р°С‚РёСЏ.' };
  }

  return { ok: true, value: { articleId } };
}

function revalidateBlogSurfaces({ articleId }) {
  revalidateTag('blog-articles');
  revalidateLocalizedPath('/blog');
  revalidateLocalizedPath(`/blog/${articleId}`);
  revalidatePath('/sitemap.xml');
}

export const POST = createRevalidatePostHandler({
  routeLabel: '/api/revalidate/blog',
  secretEnvNames: ['BLOG_REVALIDATE_SECRET', 'REVALIDATE_SECRET'],
  invalidJsonMessage: 'РќРµРІР°Р»РёРґРЅРѕ СЃСЉРґСЉСЂР¶Р°РЅРёРµ РЅР° Р·Р°СЏРІРєР°С‚Р°.',
  validatePayload,
  rateLimiter: blogRateLimiter,
  rateLimitMessage: 'Too many blog revalidation requests. Please try again later.',
  revalidate: revalidateBlogSurfaces,
  errorMessage: 'Р“СЂРµС€РєР° РїСЂРё РѕР±РЅРѕРІСЏРІР°РЅРµ РЅР° blog cache-Р°.',
});
