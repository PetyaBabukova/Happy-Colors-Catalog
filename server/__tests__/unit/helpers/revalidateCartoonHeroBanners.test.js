import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  revalidateCartoonHeroBannerSurfaces,
  revalidateCartoonHeroBannerSurfacesSafely,
} from '../../../helpers/revalidateCartoonHeroBanners.js';

describe('revalidateCartoonHeroBanner helpers', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('CLIENT_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    vi.stubEnv('NEWSLETTER_PUBLIC_SITE_URL', '');
    vi.stubEnv('PUBLIC_SITE_URL', '');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200 })));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('skips when no cartoon hero revalidation target is configured outside production', async () => {
    await expect(revalidateCartoonHeroBannerSurfaces()).resolves.toEqual({ skipped: true });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('posts to the cartoon hero revalidation endpoint with the configured secret', async () => {
    vi.stubEnv('CARTOON_HERO_BANNER_REVALIDATE_URL', 'https://happycolors.example');
    vi.stubEnv('CARTOON_HERO_BANNER_REVALIDATE_SECRET', 'cartoon-secret');

    await expect(revalidateCartoonHeroBannerSurfaces()).resolves.toEqual({
      ok: true,
      results: [
        {
          url: 'https://happycolors.example/api/revalidate/cartoon-hero-banners',
          ok: true,
          status: 200,
        },
      ],
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://happycolors.example/api/revalidate/cartoon-hero-banners',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-revalidate-secret': 'cartoon-secret',
        },
        body: '{}',
      })
    );
  });

  it('safe wrapper catches production configuration errors', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(revalidateCartoonHeroBannerSurfacesSafely()).resolves.toEqual({
      ok: false,
      error: true,
    });
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to revalidate cartoon-hero-banner surfaces:',
      'Cartoon hero banner revalidation is not configured.'
    );

    errorSpy.mockRestore();
  });
});
