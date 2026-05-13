import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('robots', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('disallows indexing outside the production site', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://test.local');

    const { default: robots } = await import('../../../src/app/robots.js');

    expect(robots()).toEqual({
      rules: {
        userAgent: '*',
        disallow: '/',
      },
      host: 'http://test.local',
    });
  });

  it('allows indexing and exposes the sitemap for the canonical production site', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://happycolors.eu');

    const { default: robots } = await import('../../../src/app/robots.js');

    expect(robots()).toEqual({
      rules: {
        userAgent: '*',
        allow: '/',
      },
      host: 'https://happycolors.eu',
      sitemap: 'https://happycolors.eu/sitemap.xml',
    });
  });
});
