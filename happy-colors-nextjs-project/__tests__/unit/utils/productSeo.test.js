import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('productSeo', () => {
  const product = {
    _id: 'product-1',
    title: 'Colorful Candle',
    description: 'Handmade candle',
    price: 12,
    availability: 'available',
    category: { name: 'Candles' },
    imageUrls: ['/images/candle.webp'],
    videos: [
      {
        url: '/videos/candle.mp4',
        posterUrl: '/posters/candle.webp',
        mimeType: 'video/mp4',
        durationSeconds: 8.3,
        uploadDate: '2026-04-01T10:00:00.000Z',
      },
      {
        url: '/videos/missing-poster.mp4',
      },
    ],
  };

  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://test.local');
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('normalizes only videos with a URL and poster URL', async () => {
    const { normalizeProductVideosForSeo } = await import('../../../src/utils/productSeo.js');

    expect(normalizeProductVideosForSeo(product.videos)).toEqual([
      {
        url: '/videos/candle.mp4',
        posterUrl: '/posters/candle.webp',
        mimeType: 'video/mp4',
        durationSeconds: 8.3,
        uploadDate: '2026-04-01T10:00:00.000Z',
      },
    ]);
  });

  it('builds product title from title and category', async () => {
    const { buildProductSeoTitle } = await import('../../../src/utils/productSeo.js');

    expect(buildProductSeoTitle(product)).toBe('Colorful Candle | Candles');
  });

  it('builds fallback SEO text for products without a category', async () => {
    const { buildProductSeoDescription, buildProductSeoTitle } = await import('../../../src/utils/productSeo.js');
    const uncategorizedProduct = { title: 'Gift Box' };

    expect(buildProductSeoTitle(uncategorizedProduct)).toBe('Gift Box');
    expect(buildProductSeoDescription(uncategorizedProduct)).toContain('Gift Box');
  });

  it('builds English SEO descriptions without Bulgarian fallback copy', async () => {
    const { buildProductSeoDescription } = await import('../../../src/utils/productSeo.js');
    const description = buildProductSeoDescription(product, 'en');

    expect(description).toContain('Colorful Candle - candles from Happy Colors');
    expect(description).toContain('A handmade piece crafted with attention to detail');
    expect(description).not.toMatch(/[А-Яа-я]/);
  });

  it('omits a pending Bulgarian category from English product SEO', async () => {
    const { buildProductSeoDescription, buildProductSeoTitle } = await import('../../../src/utils/productSeo.js');
    const productWithCategoryFallback = {
      ...product,
      category: {
        name: 'Свещи',
        contentLocale: 'bg',
        translationPending: true,
      },
    };

    expect(buildProductSeoTitle(productWithCategoryFallback, 'en')).toBe('Colorful Candle');
    expect(buildProductSeoDescription(productWithCategoryFallback, 'en')).not.toContain('Свещи');
    expect(buildProductSeoDescription(productWithCategoryFallback, 'en')).not.toMatch(/[А-Яа-я]/);
  });

  it('builds production-safe enriched JSON-LD with offer and video metadata', async () => {
    const { buildProductJsonLd } = await import('../../../src/utils/productSeo.js');
    const jsonLd = buildProductJsonLd(product);

    expect(jsonLd).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'Product',
      '@id': 'https://happycolors.eu/products/product-1#product',
      name: 'Colorful Candle',
      description: 'Handmade candle',
      url: 'https://happycolors.eu/products/product-1',
      brand: {
        '@id': 'https://happycolors.eu/#organization',
      },
      category: 'Candles',
      inLanguage: 'bg-BG',
      offers: {
        '@type': 'Offer',
        price: '12',
        priceCurrency: 'EUR',
        seller: {
          '@id': 'https://happycolors.eu/#organization',
        },
        itemCondition: 'https://schema.org/NewCondition',
        availability: 'https://schema.org/InStock',
      },
    });
    expect(jsonLd.image).toEqual(['https://happycolors.eu/images/candle.webp']);
    expect(jsonLd.video[0]).toMatchObject({
      '@type': 'VideoObject',
      contentUrl: 'https://happycolors.eu/videos/candle.mp4',
      thumbnailUrl: 'https://happycolors.eu/posters/candle.webp',
      duration: 'PT8S',
    });
    expect(jsonLd).not.toHaveProperty('review');
    expect(jsonLd).not.toHaveProperty('aggregateRating');
    expect(JSON.stringify(jsonLd)).not.toMatch(/shipping|return/i);
  });

  it('localizes generated English video JSON-LD copy', async () => {
    const { buildProductJsonLd } = await import('../../../src/utils/productSeo.js');
    const jsonLd = buildProductJsonLd(
      {
        ...product,
        description: '',
      },
      'en'
    );

    expect(jsonLd.description).not.toMatch(/[А-Яа-я]/);
    expect(jsonLd.video[0].name).toBe('Colorful Candle - video 1');
    expect(jsonLd.video[0].description).toBe(jsonLd.description);
  });

  it('uses localized production URLs for translated English Product JSON-LD', async () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');
    const { buildProductJsonLd } = await import('../../../src/utils/productSeo.js');

    const jsonLd = buildProductJsonLd(
      {
        ...product,
        contentLocale: 'en',
        translationPending: false,
      },
      'en',
      product._id
    );

    expect(jsonLd['@id']).toBe('https://happycolors.eu/en/products/product-1#product');
    expect(jsonLd.url).toBe('https://happycolors.eu/en/products/product-1');
    expect(jsonLd.inLanguage).toBe('en-US');
  });

  it('omits optional JSON-LD fields when product data is missing', async () => {
    const { buildProductJsonLd } = await import('../../../src/utils/productSeo.js');
    const jsonLd = buildProductJsonLd({
      title: 'Minimal Product',
      videos: [
        {
          url: 'bad url',
          posterUrl: '/poster.webp',
          uploadDate: 'not-a-date',
        },
      ],
    });

    expect(jsonLd).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Minimal Product',
    });
    expect(jsonLd).not.toHaveProperty('image');
    expect(jsonLd).not.toHaveProperty('offers');
    expect(jsonLd.video).toEqual([
      expect.objectContaining({
        contentUrl: 'https://happycolors.eu/bad%20url',
        thumbnailUrl: 'https://happycolors.eu/poster.webp',
        encodingFormat: 'video/mp4',
      }),
    ]);
    expect(jsonLd.video[0]).not.toHaveProperty('uploadDate');
    expect(jsonLd.video[0]).not.toHaveProperty('duration');
  });

  it('marks unavailable products as out of stock', async () => {
    const { buildProductJsonLd } = await import('../../../src/utils/productSeo.js');
    const jsonLd = buildProductJsonLd({
      ...product,
      availability: 'unavailable',
    });

    expect(jsonLd.offers.availability).toBe('https://schema.org/OutOfStock');
  });

  it('omits Product offers when price is missing or invalid', async () => {
    const { buildProductJsonLd } = await import('../../../src/utils/productSeo.js');

    expect(buildProductJsonLd({ ...product, price: '' })).not.toHaveProperty('offers');
    expect(buildProductJsonLd({ ...product, price: 'contact us' })).not.toHaveProperty('offers');
    const jsonLd = buildProductJsonLd({ ...product, price: 0 });

    expect(jsonLd).not.toHaveProperty('offers');
    expect(jsonLd).not.toHaveProperty('seller');
    expect(jsonLd).not.toHaveProperty('itemCondition');
  });

  it('builds production-safe localized product breadcrumbs', async () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');
    const { buildProductBreadcrumbJsonLd } = await import('../../../src/utils/productSeo.js');

    const breadcrumb = buildProductBreadcrumbJsonLd(product, 'en', product._id);

    expect(breadcrumb).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: 'https://happycolors.eu/en',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Products',
          item: 'https://happycolors.eu/en/products',
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'Colorful Candle',
          item: 'https://happycolors.eu/en/products/product-1',
        },
      ],
    });
    expect(JSON.stringify(breadcrumb)).not.toMatch(/localhost|preview|onrender/i);
  });

  it('builds metadata with video Open Graph data', async () => {
    const { buildProductMetadata } = await import('../../../src/utils/productSeo.js');
    const metadata = buildProductMetadata(product, product._id);

    expect(metadata.title).toBe('Colorful Candle | Candles');
    expect(metadata.alternates.canonical).toBe('/products/product-1');
    expect(metadata.alternates.languages).toEqual({
      bg: '/products/product-1',
      'x-default': '/products/product-1',
    });
    expect(metadata.openGraph.type).toBe('video.other');
    expect(metadata.openGraph.videos).toEqual([
      {
        url: 'http://test.local/videos/candle.mp4',
        secureUrl: 'http://test.local/videos/candle.mp4',
        type: 'video/mp4',
      },
    ]);
  });

  it('builds website metadata with the site OG fallback when no media exists', async () => {
    const { buildProductMetadata } = await import('../../../src/utils/productSeo.js');
    const metadata = buildProductMetadata({ title: 'No Media Product' }, 'no-media');

    expect(metadata.openGraph.type).toBe('website');
    expect(metadata.openGraph.images).toEqual([
      {
        url: 'http://test.local/lion_banner.webp',
        alt: 'No Media Product',
      },
    ]);
    expect(metadata.openGraph).not.toHaveProperty('videos');
    expect(metadata.twitter.images).toEqual(['http://test.local/lion_banner.webp']);
  });

  it('keeps product metadata canonical independent of cartoons query context', async () => {
    const { buildProductMetadata } = await import('../../../src/utils/productSeo.js');

    expect(buildProductMetadata(product, product._id).alternates.canonical).toBe('/products/product-1');
  });

  it('marks English fallback product metadata as noindex with a Bulgarian canonical', async () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');
    const {
      buildProductSeoDescription,
      buildProductMetadata,
      isProductTranslationFallback,
      shouldRenderProductJsonLd,
    } = await import('../../../src/utils/productSeo.js');
    const fallbackProduct = {
      ...product,
      contentLocale: 'bg',
      translationPending: true,
    };

    const metadata = buildProductMetadata(fallbackProduct, product._id, 'en');

    expect(isProductTranslationFallback(fallbackProduct, 'en')).toBe(true);
    expect(shouldRenderProductJsonLd(fallbackProduct, 'en')).toBe(false);
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.alternates.canonical).toBe('/bg/products/product-1');
    expect(metadata.alternates.languages).toEqual({
      bg: '/bg/products/product-1',
      'x-default': '/bg/products/product-1',
    });
    expect(metadata.description).toBe(buildProductSeoDescription(fallbackProduct, 'bg'));
    expect(metadata.openGraph.description).toBe(metadata.description);
    expect(metadata.openGraph.locale).toBe('bg_BG');
    expect(metadata.openGraph.url).toBe('/bg/products/product-1');
  });

  it('keeps translated English product metadata indexable with an English canonical', async () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');
    const { buildProductMetadata, shouldRenderProductJsonLd } = await import('../../../src/utils/productSeo.js');
    const translatedProduct = {
      ...product,
      contentLocale: 'en',
      translationPending: false,
    };

    const metadata = buildProductMetadata(translatedProduct, product._id, 'en');

    expect(shouldRenderProductJsonLd(translatedProduct, 'en')).toBe(true);
    expect(metadata).not.toHaveProperty('robots');
    expect(metadata.description).not.toMatch(/[А-Яа-я]/);
    expect(metadata.openGraph.description).toBe(metadata.description);
    expect(metadata.openGraph.locale).toBe('en_US');
    expect(metadata.openGraph.alternateLocale).toEqual(['bg_BG']);
    expect(metadata.twitter.description).toBe(metadata.description);
    expect(metadata.alternates.canonical).toBe('/en/products/product-1');
    expect(metadata.alternates.languages).toEqual({
      bg: '/bg/products/product-1',
      en: '/en/products/product-1',
      'x-default': '/bg/products/product-1',
    });
  });

  it('adds reciprocal English hreflang for Bulgarian product metadata with a valid English alternate', async () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');
    const { buildProductMetadata } = await import('../../../src/utils/productSeo.js');
    const translatedProduct = {
      ...product,
      availableLocales: ['bg', 'en'],
    };

    const metadata = buildProductMetadata(translatedProduct, product._id, 'bg');

    expect(metadata.alternates).toEqual({
      canonical: '/bg/products/product-1',
      languages: {
        bg: '/bg/products/product-1',
        en: '/en/products/product-1',
        'x-default': '/bg/products/product-1',
      },
    });
    expect(metadata.openGraph.locale).toBe('bg_BG');
    expect(metadata.openGraph.alternateLocale).toEqual(['en_US']);
  });

  it('omits English hreflang for Bulgarian product metadata without a valid English alternate', async () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');
    const { buildProductMetadata } = await import('../../../src/utils/productSeo.js');
    const untranslatedProduct = {
      ...product,
      availableLocales: ['bg'],
    };

    const metadata = buildProductMetadata(untranslatedProduct, product._id, 'bg');

    expect(metadata.alternates).toEqual({
      canonical: '/bg/products/product-1',
      languages: {
        bg: '/bg/products/product-1',
        'x-default': '/bg/products/product-1',
      },
    });
  });

  it('escapes unsafe JSON-LD characters', async () => {
    const { stringifyJsonLd } = await import('../../../src/utils/productSeo.js');

    expect(stringifyJsonLd({ value: '<script>' })).toBe('{"value":"\\u003cscript>"}');
  });
});
