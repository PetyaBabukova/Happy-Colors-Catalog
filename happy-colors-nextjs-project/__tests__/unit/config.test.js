import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('config baseURL', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('uses a valid NEXT_PUBLIC_API_URL override without trailing slashes', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.happycolors.eu/api///');

    const { default: baseURL } = await import('../../src/config.js');

    expect(baseURL).toBe('https://api.happycolors.eu/api');
  });

  it('uses a backend root NEXT_PUBLIC_API_URL override as-is', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.happycolors.eu');

    const { default: baseURL } = await import('../../src/config.js');

    expect(baseURL).toBe('https://api.happycolors.eu');
  });

  it('uses the deployed site API URL for server-side fetches when no API override is configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://preview.happycolors.eu/');
    vi.stubEnv('PORT', '4321');

    const { default: baseURL } = await import('../../src/config.js');

    expect(baseURL).toBe('https://preview.happycolors.eu/api');
  });

  it('defaults to the local server API URL when no override is configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', '');
    vi.stubEnv('PORT', '');

    const { default: baseURL } = await import('../../src/config.js');

    expect(baseURL).toBe('http://localhost:3000/api');
  });

  it('allows next image previews from the configured GCS bucket', async () => {
    vi.stubEnv('GCS_BUCKET_NAME', 'happycolors-dev-bucket');

    const { default: nextConfig } = await import('../../next.config.mjs');

    expect(nextConfig.images.remotePatterns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          hostname: 'storage.googleapis.com',
          pathname: '/happycolors-dev-bucket/**',
        }),
      ])
    );
  });
});
