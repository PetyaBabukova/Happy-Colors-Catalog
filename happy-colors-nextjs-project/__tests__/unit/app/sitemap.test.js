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

  it('adds static and product entries for the production sitemap', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://happycolors.eu');
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://happycolors.eu/api');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => [
          { _id: 'red-candle', updatedAt: '2026-05-01T12:00:00.000Z' },
          { title: 'Missing id' },
          { _id: 'blue-soap', createdAt: '2026-04-28T10:00:00.000Z' },
        ],
      }))
    );

    const { default: sitemap } = await import('../../../src/app/sitemap.js');
    const entries = await sitemap();

    expect(fetch).toHaveBeenCalledWith('https://happycolors.eu/api/products', {
      next: { revalidate: 3600 },
    });
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
        url: 'https://happycolors.eu/contacts',
        lastModified: new Date('2026-05-07T09:00:00.000Z'),
        changeFrequency: 'monthly',
        priority: 0.7,
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
    ]);
  });

  it('falls back to static entries when the product fetch fails', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://happycolors.eu');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));

    const { default: sitemap } = await import('../../../src/app/sitemap.js');
    const entries = await sitemap();

    expect(entries).toHaveLength(5);
    expect(entries.map((entry) => entry.url)).toEqual([
      'https://happycolors.eu/',
      'https://happycolors.eu/products',
      'https://happycolors.eu/aboutus',
      'https://happycolors.eu/faq',
      'https://happycolors.eu/contacts',
    ]);
  });
});
