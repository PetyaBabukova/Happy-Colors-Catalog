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

  it('proxies cartoon order backend routes without overriding local cartoon upload API routes', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.happycolors.eu');

    const { default: nextConfig } = await import('../../next.config.mjs');
    const rewrites = await nextConfig.rewrites();

    expect(rewrites).toEqual(
      expect.arrayContaining([
        {
          source: '/api/cartoon-orders',
          destination: 'https://api.happycolors.eu/cartoon-orders',
        },
        {
          source: '/api/cartoon-orders/:orderId([a-fA-F0-9]{24})',
          destination: 'https://api.happycolors.eu/cartoon-orders/:orderId',
        },
        {
          source: '/api/cartoon-orders/:orderId([a-fA-F0-9]{24})/statuses',
          destination: 'https://api.happycolors.eu/cartoon-orders/:orderId/statuses',
        },
        {
          source: '/api/cartoon-orders/:orderId([a-fA-F0-9]{24})/admin-notes',
          destination: 'https://api.happycolors.eu/cartoon-orders/:orderId/admin-notes',
        },
        {
          source: '/api/cartoon-orders/:orderId([a-fA-F0-9]{24})/workflow',
          destination: 'https://api.happycolors.eu/cartoon-orders/:orderId/workflow',
        },
        {
          source: '/api/cartoon-orders/:orderId([a-fA-F0-9]{24})/reject',
          destination: 'https://api.happycolors.eu/cartoon-orders/:orderId/reject',
        },
        {
          source: '/api/cartoon-orders/:orderId([a-fA-F0-9]{24})/complete',
          destination: 'https://api.happycolors.eu/cartoon-orders/:orderId/complete',
        },
        {
          source: '/api/cartoon-orders/:orderId([a-fA-F0-9]{24})/photo-diagnostics',
          destination: 'https://api.happycolors.eu/cartoon-orders/:orderId/photo-diagnostics',
        },
        {
          source: '/api/cartoon-orders/:orderId([a-fA-F0-9]{24})/photos/:photoId([A-Za-z0-9_-]{1,80})',
          destination: 'https://api.happycolors.eu/cartoon-orders/:orderId/photos/:photoId',
        },
        {
          source: '/api/cartoon-orders/:orderId([a-fA-F0-9]{24})/notifications/retry',
          destination: 'https://api.happycolors.eu/cartoon-orders/:orderId/notifications/retry',
        },
        {
          source: '/api/cartoon-orders/purge-old-completed',
          destination: 'https://api.happycolors.eu/cartoon-orders/purge-old-completed',
        },
      ])
    );
    expect(rewrites).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: '/api/cartoon-orders/upload-session',
        }),
        expect.objectContaining({
          source: '/api/cartoon-orders/uploads',
        }),
        expect.objectContaining({
          source: '/api/cartoon-orders/uploads/cleanup',
        }),
      ])
    );
    expect(rewrites).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: '/api/cartoon-orders/:path*',
        }),
      ])
    );
  });
});
