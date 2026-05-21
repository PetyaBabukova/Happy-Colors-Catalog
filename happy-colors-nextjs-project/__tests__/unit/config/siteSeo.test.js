import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('siteSeo', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('treats main branch with the canonical URL as the indexable production site', async () => {
    vi.stubEnv('RENDER_GIT_BRANCH', 'main');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://happycolors.eu/');

    const siteSeo = await import('../../../src/config/siteSeo.js');

    expect(siteSeo.SITE_OG_IMAGE_PATH).toBe('/og/happy-colors-og.png');
    expect(siteSeo.SITE_ENV).toBe('production');
    expect(siteSeo.currentSiteUrl).toBe('https://happycolors.eu');
    expect(siteSeo.shouldIndexSite).toBe(true);
    expect(siteSeo.shouldExposeSitemap).toBe(true);
    expect(siteSeo.buildPageMetadata({
      title: 'Shop',
      description: 'Products',
      path: '/products',
    })).toEqual({
      title: 'Shop',
      description: 'Products',
      robots: { index: true, follow: true },
      alternates: { canonical: '/products' },
    });
  });

  it('blocks indexing for pull-request previews even when production env is set', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://happycolors.eu');
    vi.stubEnv('IS_PULL_REQUEST', 'true');

    const siteSeo = await import('../../../src/config/siteSeo.js');

    expect(siteSeo.isPreviewSite).toBe(true);
    expect(siteSeo.shouldIndexSite).toBe(false);
    expect(siteSeo.shouldExposeSitemap).toBe(false);
    expect(siteSeo.buildPageMetadata({
      title: 'Cart',
      description: 'Private cart',
      path: '/cart',
      indexable: false,
    })).toEqual({
      title: 'Cart',
      description: 'Private cart',
      robots: { index: false, follow: false },
    });
  });

  it('falls back to render external URL for non-production deployments', async () => {
    vi.stubEnv('RENDER_GIT_BRANCH', 'feature-preview');
    vi.stubEnv('RENDER_EXTERNAL_URL', 'https://preview.example.com/');

    const siteSeo = await import('../../../src/config/siteSeo.js');

    expect(siteSeo.SITE_ENV).toBe('development');
    expect(siteSeo.currentSiteUrl).toBe('https://preview.example.com');
    expect(siteSeo.metadataBaseUrl.href).toBe('https://preview.example.com/');
    expect(siteSeo.shouldIndexSite).toBe(false);
  });
});
