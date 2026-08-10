import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  revalidateHomeBannerSurfaces,
  revalidateHomeBannerSurfacesSafely,
} from '../../../helpers/revalidateHomeBanners.js';

describe('revalidateHomeBanner helpers', () => {
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

  it('skips when no home-banner revalidation target is configured outside production', async () => {
    await expect(revalidateHomeBannerSurfaces()).resolves.toEqual({ skipped: true });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('posts to the home-banner revalidation endpoint with the configured secret', async () => {
    vi.stubEnv('HOME_BANNER_REVALIDATE_URL', 'https://happycolors.example');
    vi.stubEnv('HOME_BANNER_REVALIDATE_SECRET', 'home-banner-secret');

    await expect(revalidateHomeBannerSurfaces()).resolves.toEqual({
      ok: true,
      results: [
        {
          url: 'https://happycolors.example/api/revalidate/home-banners',
          ok: true,
          status: 200,
        },
      ],
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://happycolors.example/api/revalidate/home-banners',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-revalidate-secret': 'home-banner-secret',
        },
        body: '{}',
      })
    );
  });

  it('safe wrapper catches production configuration errors', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(revalidateHomeBannerSurfacesSafely()).resolves.toEqual({
      ok: false,
      error: true,
    });
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to revalidate home-banner surfaces:',
      'Home banner revalidation is not configured.'
    );

    errorSpy.mockRestore();
  });
});
