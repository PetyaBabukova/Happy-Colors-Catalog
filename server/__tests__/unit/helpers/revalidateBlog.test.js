import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  revalidateBlogSurfaces,
  revalidateBlogSurfacesSafely,
} from '../../../helpers/revalidateBlog.js';

describe('revalidateBlog helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('skips outside production when revalidation is not configured', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('BLOG_REVALIDATE_URL', '');
    vi.stubEnv('BLOG_REVALIDATE_SECRET', '');
    vi.stubEnv('REVALIDATE_SECRET', '');

    await expect(revalidateBlogSurfaces({ articleId: '507f1f77bcf86cd799439011' })).resolves.toEqual({
      skipped: true,
    });
  });

  it('posts to configured blog revalidation targets with the shared secret', async () => {
    vi.stubEnv('BLOG_REVALIDATE_URL', 'https://happycolors.eu');
    vi.stubEnv('BLOG_REVALIDATE_SECRET', 'blog-secret');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));

    await expect(revalidateBlogSurfaces({ articleId: '507f1f77bcf86cd799439011' })).resolves.toMatchObject({
      ok: true,
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://happycolors.eu/api/revalidate/blog',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-revalidate-secret': 'blog-secret',
        }),
        body: JSON.stringify({ articleId: '507f1f77bcf86cd799439011' }),
      })
    );
  });

  it('does not throw from the safe wrapper when production config is missing', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CLIENT_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    vi.stubEnv('NEWSLETTER_PUBLIC_SITE_URL', '');
    vi.stubEnv('PUBLIC_SITE_URL', '');
    vi.stubEnv('BLOG_REVALIDATE_URL', '');
    vi.stubEnv('BLOG_REVALIDATE_SECRET', '');
    vi.stubEnv('REVALIDATE_SECRET', '');

    await expect(revalidateBlogSurfacesSafely({ articleId: '507f1f77bcf86cd799439011' })).resolves.toEqual({
      ok: false,
      error: true,
    });

    expect(consoleError).toHaveBeenCalled();
  });
});
