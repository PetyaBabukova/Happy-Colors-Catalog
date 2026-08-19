import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('cartoonsSeo', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('builds production-safe Service JSON-LD for localized cartoons pages', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_ENV', 'preview');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://happy-colors-preview.onrender.com');
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');

    const { getCartoonsPageContent } = await import('../../../src/content/publicPages/cartoons.js');
    const { buildCartoonServiceJsonLd } = await import('../../../src/utils/cartoonsSeo.js');
    const content = getCartoonsPageContent('en');
    const jsonLd = buildCartoonServiceJsonLd({
      content,
      path: '/cartoons',
      locale: 'en',
    });

    expect(jsonLd).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'Service',
      '@id': 'https://happycolors.eu/en/cartoons#service',
      name: content.intro.title,
      description: content.metadata.description,
      serviceType: content.intro.title,
      url: 'https://happycolors.eu/en/cartoons',
      provider: {
        '@type': 'Organization',
        '@id': 'https://happycolors.eu/#organization',
        name: 'Happy Colors',
      },
      inLanguage: 'en-US',
      isPartOf: {
        '@id': 'https://happycolors.eu/#website',
      },
    });
    expect(jsonLd).not.toHaveProperty('aggregateRating');
    expect(jsonLd).not.toHaveProperty('review');
    expect(jsonLd).not.toHaveProperty('offers');
    expect(JSON.stringify(jsonLd)).not.toMatch(/localhost|preview|onrender|vercel|netlify/i);
  });

  it('builds ordered breadcrumbs for the offer page hierarchy', async () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');

    const { getCartoonsOfferPageContent } = await import('../../../src/content/publicPages/cartoons.js');
    const { buildCartoonsBreadcrumbJsonLd } = await import('../../../src/utils/cartoonsSeo.js');
    const offerContent = getCartoonsOfferPageContent('en');
    const breadcrumb = buildCartoonsBreadcrumbJsonLd({
      currentName: offerContent.hero.title,
      path: '/cartoons/offer',
      locale: 'en',
    });

    expect(breadcrumb.itemListElement).toEqual([
      expect.objectContaining({
        position: 1,
        name: 'Home',
        item: 'https://happycolors.eu/en',
      }),
      expect.objectContaining({
        position: 2,
        item: 'https://happycolors.eu/en/cartoons',
      }),
      expect.objectContaining({
        position: 3,
        name: offerContent.hero.title,
        item: 'https://happycolors.eu/en/cartoons/offer',
      }),
    ]);
  });
});
