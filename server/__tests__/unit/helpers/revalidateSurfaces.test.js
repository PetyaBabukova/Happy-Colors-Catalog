import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRevalidateSurfaceHelpers } from '../../../helpers/revalidateSurfaces.js';

function createHelpers(options = {}) {
  return createRevalidateSurfaceHelpers({
    surfaceName: 'demo',
    endpointPath: '/api/revalidate/demo',
    urlEnvNames: ['DEMO_REVALIDATE_URLS', 'DEMO_REVALIDATE_URL'],
    secretEnvNames: ['DEMO_REVALIDATE_SECRET', 'REVALIDATE_SECRET'],
    buildBody: ({ id } = {}) => (id ? { id: String(id) } : {}),
    missingConfigurationMessage: 'Demo revalidation is not configured.',
    ...options,
  });
}

describe('revalidate surface helper factory', () => {
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

  it('skips quietly outside production when urls or secrets are missing', async () => {
    const { revalidateSurfaces } = createHelpers();

    await expect(revalidateSurfaces({ id: 'demo-1' })).resolves.toEqual({ skipped: true });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('throws on missing configuration in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { revalidateSurfaces } = createHelpers();

    await expect(revalidateSurfaces({ id: 'demo-1' })).rejects.toThrow(
      'Demo revalidation is not configured.'
    );
  });

  it('treats shouldSkip as an intentional skip even in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { revalidateSurfaces } = createHelpers({
      shouldSkip: ({ id } = {}) => !id,
    });

    await expect(revalidateSurfaces()).resolves.toEqual({ skipped: true });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('posts to explicit and inferred urls with the first configured secret', async () => {
    vi.stubEnv('DEMO_REVALIDATE_URLS', 'https://admin.example/api/revalidate/demo, https://site.example');
    vi.stubEnv('CLIENT_URL', 'https://admin.example');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://public.example/');
    vi.stubEnv('DEMO_REVALIDATE_SECRET', '');
    vi.stubEnv('REVALIDATE_SECRET', 'fallback-secret');
    const { revalidateSurfaces } = createHelpers();

    await expect(revalidateSurfaces({ id: 'demo-1' })).resolves.toEqual({
      ok: true,
      results: [
        { url: 'https://admin.example/api/revalidate/demo', ok: true, status: 200 },
        { url: 'https://site.example/api/revalidate/demo', ok: true, status: 200 },
        { url: 'https://public.example/api/revalidate/demo', ok: true, status: 200 },
      ],
    });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch).toHaveBeenCalledWith(
      'https://admin.example/api/revalidate/demo',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-revalidate-secret': 'fallback-secret',
        },
        body: JSON.stringify({ id: 'demo-1' }),
      })
    );
  });

  it('returns failed result entries when a fetch call throws', async () => {
    vi.stubEnv('DEMO_REVALIDATE_URL', 'https://admin.example');
    vi.stubEnv('DEMO_REVALIDATE_SECRET', 'secret');
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('network down');
    }));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { revalidateSurfaces } = createHelpers();

    await expect(revalidateSurfaces({ id: 'demo-1' })).resolves.toEqual({
      ok: false,
      results: [
        { url: 'https://admin.example/api/revalidate/demo', ok: false, error: true },
      ],
    });
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to revalidate demo surfaces:',
      'network down'
    );

    errorSpy.mockRestore();
  });

  it('safe wrapper catches production configuration errors', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { revalidateSurfacesSafely } = createHelpers();

    await expect(revalidateSurfacesSafely({ id: 'demo-1' })).resolves.toEqual({
      ok: false,
      error: true,
    });
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to revalidate demo surfaces:',
      'Demo revalidation is not configured.'
    );

    errorSpy.mockRestore();
  });
});
