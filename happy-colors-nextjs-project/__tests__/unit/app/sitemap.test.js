import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('sitemap', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-07T09:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('returns an empty sitemap outside the indexable production site', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_ENV', 'preview');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://preview.happycolors.eu');
    vi.stubGlobal('fetch', vi.fn());

    const { default: sitemap } = await import('../../../src/app/sitemap.js');

    await expect(sitemap()).resolves.toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('adds static, product, and blog entries for the production sitemap', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://happycolors.eu');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            { _id: 'red-candle', updatedAt: '2026-05-01T12:00:00.000Z' },
            { title: 'Missing id' },
            { _id: 'blue-soap', createdAt: '2026-04-28T10:00:00.000Z' },
          ],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            { _id: 'blog-1', updatedAt: '2026-05-03T12:00:00.000Z' },
            { title: 'Missing id' },
            { _id: 'blog-2', publishedAt: '2026-05-02T10:00:00.000Z' },
          ],
        })
    );

    const { default: sitemap } = await import('../../../src/app/sitemap.js');
    const entries = await sitemap();

    expect(fetch).toHaveBeenCalledWith('https://happycolors.eu/api/products', {
      next: { revalidate: 3600, tags: ['products'] },
    });
    expect(fetch).toHaveBeenCalledWith('https://happycolors.eu/api/blog-articles', {
      next: { revalidate: 3600, tags: ['blog-articles'] },
    });
    expect(entries.map((entry) => entry.url)).not.toContain('https://happycolors.eu/cartoons');
    expect(entries).toEqual([
      {
        url: 'https://happycolors.eu/',
        lastModified: new Date('2026-05-07T09:00:00.000Z'),
        changeFrequency: 'weekly',
        priority: 1,
      },
      {
        url: 'https://happycolors.eu/products',
        lastModified: new Date('2026-05-07T09:00:00.000Z'),
        changeFrequency: 'daily',
        priority: 0.9,
      },
      {
        url: 'https://happycolors.eu/aboutus',
        lastModified: new Date('2026-05-07T09:00:00.000Z'),
        changeFrequency: 'monthly',
        priority: 0.7,
      },
      {
        url: 'https://happycolors.eu/faq',
        lastModified: new Date('2026-05-07T09:00:00.000Z'),
        changeFrequency: 'monthly',
        priority: 0.6,
      },
      {
        url: 'https://happycolors.eu/gifts',
        lastModified: new Date('2026-05-07T09:00:00.000Z'),
        changeFrequency: 'monthly',
        priority: 0.75,
      },
      {
        url: 'https://happycolors.eu/gifts/gifts-for-children',
        lastModified: new Date('2026-05-07T09:00:00.000Z'),
        changeFrequency: 'monthly',
        priority: 0.7,
      },
      {
        url: 'https://happycolors.eu/gifts/handmade-crochet-toy-gift',
        lastModified: new Date('2026-05-07T09:00:00.000Z'),
        changeFrequency: 'monthly',
        priority: 0.7,
      },
      {
        url: 'https://happycolors.eu/gifts/original-handmade-gift',
        lastModified: new Date('2026-05-07T09:00:00.000Z'),
        changeFrequency: 'monthly',
        priority: 0.7,
      },
      {
        url: 'https://happycolors.eu/blog',
        lastModified: new Date('2026-05-07T09:00:00.000Z'),
        changeFrequency: 'weekly',
        priority: 0.7,
      },
      {
        url: 'https://happycolors.eu/contacts',
        lastModified: new Date('2026-05-07T09:00:00.000Z'),
        changeFrequency: 'monthly',
        priority: 0.7,
      },
      {
        url: 'https://happycolors.eu/partners',
        lastModified: new Date('2026-05-07T09:00:00.000Z'),
        changeFrequency: 'monthly',
        priority: 0.6,
      },
      {
        url: 'https://happycolors.eu/products/red-candle',
        lastModified: new Date('2026-05-01T12:00:00.000Z'),
        changeFrequency: 'weekly',
        priority: 0.8,
      },
      {
        url: 'https://happycolors.eu/products/blue-soap',
        lastModified: new Date('2026-04-28T10:00:00.000Z'),
        changeFrequency: 'weekly',
        priority: 0.8,
      },
      {
        url: 'https://happycolors.eu/blog/blog-1',
        lastModified: new Date('2026-05-03T12:00:00.000Z'),
        changeFrequency: 'monthly',
        priority: 0.65,
      },
      {
        url: 'https://happycolors.eu/blog/blog-2',
        lastModified: new Date('2026-05-02T10:00:00.000Z'),
        changeFrequency: 'monthly',
        priority: 0.65,
      },
    ]);
  });

  it('adds cartoons to the production sitemap only when the release gate is enabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://happycolors.eu');
    vi.stubEnv('NEXT_PUBLIC_CARTOONS_SERVICE_ENABLED', 'true');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => [] })));

    const { default: sitemap } = await import('../../../src/app/sitemap.js');
    const entries = await sitemap();

    expect(entries.map((entry) => entry.url)).toContain('https://happycolors.eu/cartoons');
    expect(entries.map((entry) => entry.url)).toContain('https://happycolors.eu/cartoons/offer');
  });

  it('emits localized sitemap entries and includes English dynamic URLs only for translated content', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://happycolors.eu');
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            {
              _id: 'translated-product',
              updatedAt: '2026-05-01T12:00:00.000Z',
              availableLocales: ['bg', 'en'],
            },
            {
              _id: 'fallback-product',
              updatedAt: '2026-05-02T12:00:00.000Z',
              availableLocales: ['bg'],
            },
          ],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            {
              _id: 'translated-blog',
              publishedAt: '2026-05-03T12:00:00.000Z',
              availableLocales: ['bg', 'en'],
            },
            {
              _id: 'bg-only-blog',
              publishedAt: '2026-05-04T12:00:00.000Z',
              availableLocales: ['bg'],
            },
          ],
        })
    );

    const { default: sitemap } = await import('../../../src/app/sitemap.js');
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls.every((url) => /^https:\/\/happycolors\.eu\/(?:bg|en)(?:\/|$)/.test(url))).toBe(true);
    expect(urls).toContain('https://happycolors.eu/bg');
    expect(urls).toContain('https://happycolors.eu/en');
    expect(urls).toContain('https://happycolors.eu/bg/gifts');
    expect(urls).toContain('https://happycolors.eu/en/gifts');
    expect(urls).toContain('https://happycolors.eu/bg/gifts/gifts-for-children');
    expect(urls).toContain('https://happycolors.eu/en/gifts/gifts-for-children');
    expect(urls).toContain('https://happycolors.eu/bg/partners');
    expect(urls).toContain('https://happycolors.eu/en/partners');
    expect(urls).toContain('https://happycolors.eu/bg/products/translated-product');
    expect(urls).toContain('https://happycolors.eu/en/products/translated-product');
    expect(urls).toContain('https://happycolors.eu/bg/products/fallback-product');
    expect(urls).not.toContain('https://happycolors.eu/en/products/fallback-product');
    expect(urls).toContain('https://happycolors.eu/bg/blog/translated-blog');
    expect(urls).toContain('https://happycolors.eu/en/blog/translated-blog');
    expect(urls).toContain('https://happycolors.eu/bg/blog/bg-only-blog');
    expect(urls).not.toContain('https://happycolors.eu/en/blog/bg-only-blog');
    expect(entries.find((entry) => entry.url === 'https://happycolors.eu/en/products/translated-product')).toMatchObject({
      alternates: {
        languages: {
          bg: 'https://happycolors.eu/bg/products/translated-product',
          en: 'https://happycolors.eu/en/products/translated-product',
          'x-default': 'https://happycolors.eu/bg/products/translated-product',
        },
      },
    });
    expect(entries.find((entry) => entry.url === 'https://happycolors.eu/bg/products/fallback-product')).toMatchObject({
      alternates: {
        languages: {
          bg: 'https://happycolors.eu/bg/products/fallback-product',
          'x-default': 'https://happycolors.eu/bg/products/fallback-product',
        },
      },
    });
    expect(entries.find((entry) => entry.url === 'https://happycolors.eu/en')).toMatchObject({
      alternates: {
        languages: {
          bg: 'https://happycolors.eu/bg',
          en: 'https://happycolors.eu/en',
          'x-default': 'https://happycolors.eu/bg',
        },
      },
    });
    expect(entries.find((entry) => entry.url === 'https://happycolors.eu/en/gifts/gifts-for-children')).toMatchObject({
      alternates: {
        languages: {
          bg: 'https://happycolors.eu/bg/gifts/gifts-for-children',
          en: 'https://happycolors.eu/en/gifts/gifts-for-children',
          'x-default': 'https://happycolors.eu/bg/gifts/gifts-for-children',
        },
      },
    });
  });

  it('emits only Bulgarian localized sitemap entries when English is disabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://happycolors.eu');
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'false');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            {
              _id: 'translated-product',
              updatedAt: '2026-05-01T12:00:00.000Z',
              availableLocales: ['bg', 'en'],
            },
          ],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            {
              _id: 'translated-blog',
              publishedAt: '2026-05-03T12:00:00.000Z',
              availableLocales: ['bg', 'en'],
            },
          ],
        })
    );

    const { default: sitemap } = await import('../../../src/app/sitemap.js');
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toContain('https://happycolors.eu/bg');
    expect(urls).toContain('https://happycolors.eu/bg/gifts');
    expect(urls).toContain('https://happycolors.eu/bg/gifts/original-handmade-gift');
    expect(urls).toContain('https://happycolors.eu/bg/products/translated-product');
    expect(urls).toContain('https://happycolors.eu/bg/blog/translated-blog');
    expect(urls.some((url) => url.includes('https://happycolors.eu/en'))).toBe(false);
    expect(entries.find((entry) => entry.url === 'https://happycolors.eu/bg/products/translated-product')).toMatchObject({
      alternates: {
        languages: {
          bg: 'https://happycolors.eu/bg/products/translated-product',
          'x-default': 'https://happycolors.eu/bg/products/translated-product',
        },
      },
    });
  });

  it('falls back to static entries when dynamic sitemap fetches fail', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://happycolors.eu');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));

    const { default: sitemap } = await import('../../../src/app/sitemap.js');
    const entries = await sitemap();

    expect(fetch).toHaveBeenCalledWith('https://happycolors.eu/api/products', {
      next: { revalidate: 3600, tags: ['products'] },
    });
    expect(fetch).toHaveBeenCalledWith('https://happycolors.eu/api/blog-articles', {
      next: { revalidate: 3600, tags: ['blog-articles'] },
    });
    expect(entries).toHaveLength(11);
    expect(entries.map((entry) => entry.url)).toEqual([
      'https://happycolors.eu/',
      'https://happycolors.eu/products',
      'https://happycolors.eu/aboutus',
      'https://happycolors.eu/faq',
      'https://happycolors.eu/gifts',
      'https://happycolors.eu/gifts/gifts-for-children',
      'https://happycolors.eu/gifts/handmade-crochet-toy-gift',
      'https://happycolors.eu/gifts/original-handmade-gift',
      'https://happycolors.eu/blog',
      'https://happycolors.eu/contacts',
      'https://happycolors.eu/partners',
    ]);
  });
});
