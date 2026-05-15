import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('config baseURL', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

  it('uses NEXT_PUBLIC_BASE_URL as a server-side backend override', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', '');
    vi.stubEnv('NEXT_PUBLIC_BASE_URL', 'http://localhost:3030/');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://happycolors.eu');

    const { default: baseURL } = await import('../../src/config.js');

    expect(baseURL).toBe('http://localhost:3030');
  });

  it('uses the same-origin API proxy in the browser', async () => {
    vi.stubGlobal('window', {});
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.happycolors.eu');
    vi.stubEnv('NEXT_PUBLIC_BASE_URL', 'http://localhost:3030');

    const { default: baseURL } = await import('../../src/config.js');

    expect(baseURL).toBe('/api');
  });

  it('uses the deployed site API URL for server-side fetches when no API override is configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', '');
    vi.stubEnv('NEXT_PUBLIC_BASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://preview.happycolors.eu/');
    vi.stubEnv('PORT', '4321');

    const { default: baseURL } = await import('../../src/config.js');

    expect(baseURL).toBe('https://preview.happycolors.eu/api');
  });

  it('defaults to the local server API URL when no override is configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', '');
    vi.stubEnv('NEXT_PUBLIC_BASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
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
