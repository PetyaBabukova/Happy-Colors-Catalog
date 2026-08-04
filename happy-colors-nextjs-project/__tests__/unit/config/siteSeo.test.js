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
      alternates: {
        canonical: '/products',
        languages: {
          bg: '/products',
          'x-default': '/products',
        },
      },
      openGraph: {
        title: 'Shop',
        description: 'Products',
        type: 'website',
        url: '/products',
        siteName: 'Happy Colors',
        locale: 'bg_BG',
        images: [
          {
            url: '/og/happy-colors-og.png',
            alt: 'Shop',
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: 'Shop',
        description: 'Products',
        images: ['/og/happy-colors-og.png'],
      },
    });
  });

  it('builds localized language alternates only for enabled public locales', async () => {
    vi.stubEnv('RENDER_GIT_BRANCH', 'main');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://happycolors.eu/');
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');

    const siteSeo = await import('../../../src/config/siteSeo.js');

    expect(siteSeo.buildLocalizedAlternates('/products', 'en')).toEqual({
      canonical: '/en/products',
      languages: {
        bg: '/bg/products',
        en: '/en/products',
        'x-default': '/bg/products',
      },
    });
    expect(siteSeo.getOpenGraphLocale('en')).toBe('en_US');
    expect(siteSeo.getOpenGraphAlternateLocales('en')).toEqual(['bg_BG']);

    expect(siteSeo.buildPageMetadata({
      title: { absolute: 'Shop' },
      description: 'Products',
      path: '/products',
      locale: 'en',
      imageAlt: 'Colorful products',
    })).toMatchObject({
      alternates: {
        canonical: '/en/products',
      },
      openGraph: {
        title: 'Shop',
        url: '/en/products',
        locale: 'en_US',
        alternateLocale: ['bg_BG'],
        images: [
          {
            url: '/og/happy-colors-og.png',
            alt: 'Colorful products',
          },
        ],
      },
      twitter: {
        title: 'Shop',
      },
    });
  });

  it('omits English hreflang while the English public locale is disabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'false');

    const siteSeo = await import('../../../src/config/siteSeo.js');

    expect(siteSeo.buildLocalizedAlternates('/products', 'bg')).toEqual({
      canonical: '/bg/products',
      languages: {
        bg: '/bg/products',
        'x-default': '/bg/products',
      },
    });
  });

  it('filters explicit English alternates while the English public locale is disabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'false');

    const siteSeo = await import('../../../src/config/siteSeo.js');

    expect(siteSeo.buildLocalizedLanguageAlternates('/products/product-1', {
      enabledLocales: ['bg', 'en'],
    })).toEqual({
      bg: '/bg/products/product-1',
      'x-default': '/bg/products/product-1',
    });
  });

  it('filters unsupported alternates and can omit x-default', async () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');

    const siteSeo = await import('../../../src/config/siteSeo.js');

    expect(siteSeo.buildLocalizedLanguageAlternates('/blog', {
      enabledLocales: ['bg', 'fr', 'en'],
      includeXDefault: false,
    })).toEqual({
      bg: '/bg/blog',
      en: '/en/blog',
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
    expect(siteSeo.buildPageMetadata({
      title: 'Preview page',
      description: 'Preview content',
      path: '/products',
    })).toEqual({
      title: 'Preview page',
      description: 'Preview content',
      robots: { index: false, follow: false },
    });
  });
});
