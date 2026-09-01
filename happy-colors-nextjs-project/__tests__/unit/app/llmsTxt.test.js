import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('llms.txt route', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('returns a concise text index with canonical localized public URLs', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://happycolors.eu');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_CARTOONS_SERVICE_ENABLED', 'true');

    const { GET } = await import('../../../src/app/llms.txt/route.js');
    const response = GET();
    const body = await response.text();

    expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    expect(body).toContain('# Happy Colors');
    expect(body).toContain('## Public Pages');
    expect(body).toContain('### Catalog');
    expect(body).toContain('### Gift Guides');
    expect(body).toContain('### Caricatures');
    expect(body).toContain('https://happycolors.eu/bg');
    expect(body).toContain('https://happycolors.eu/en');
    expect(body).toContain('https://happycolors.eu/bg/products');
    expect(body).toContain('https://happycolors.eu/bg/gifts');
    expect(body).toContain('https://happycolors.eu/en/gifts/gifts-for-children');
    expect(body).toContain('https://happycolors.eu/bg/cartoons');
    expect(body).toContain('https://happycolors.eu/en/cartoons/offer');
    expect(body).toContain('https://happycolors.eu/bg/blog');
    expect(body).toContain('https://happycolors.eu/en/faq');
    expect(body).toContain('https://happycolors.eu/bg/contacts');
    expect(body).toContain('https://happycolors.eu/en/aboutus');
    expect(body).toContain('https://happycolors.eu/bg/partners');
    expect(body).toContain('[BG Catalog](https://happycolors.eu/bg/products)');
    expect(body).toContain('[EN Gifts For Children](https://happycolors.eu/en/gifts/gifts-for-children)');
    expect(body).toContain('https://happycolors.eu/sitemap.xml');
    expect(body).toMatch(/not a crawler access-control file/i);
    expect(body).not.toMatch(/localhost|preview|onrender|vercel|netlify|podaraci/i);
    expect(body).not.toMatch(/\/api|\/admin|\/cart(?:\/|\b)|\/cartoon-orders|\/checkout|\/users/);
    expect(body).not.toMatch(/facebook|instagram|etsy|youtube|tiktok/i);
  });

  it('does not expose llms.txt outside the indexable production site', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000');

    const { GET } = await import('../../../src/app/llms.txt/route.js');
    const response = GET();
    const body = await response.text();

    expect(response.status).toBe(404);
    expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    expect(body).toBe('');
  });

  it('omits cartoons pages while the cartoons service gate is disabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_CARTOONS_SERVICE_ENABLED', 'false');

    const { buildLlmsTxt } = await import('../../../src/app/llms.txt/route.js');
    const body = buildLlmsTxt();

    expect(body).not.toMatch(/\/cartoons(?:\/|\))/);
    expect(body).not.toContain('### Caricatures');
    expect(body).not.toMatch(/caricature/i);
  });

  it('emits only Bulgarian URLs while the English public locale is disabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'false');
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_CARTOONS_SERVICE_ENABLED', 'true');

    const { buildLlmsTxt } = await import('../../../src/app/llms.txt/route.js');
    const body = buildLlmsTxt();

    expect(body).toContain('https://happycolors.eu/bg/products');
    expect(body).toContain('https://happycolors.eu/bg/gifts/gifts-for-children');
    expect(body).toContain('https://happycolors.eu/bg/cartoons');
    expect(body).not.toMatch(/https:\/\/happycolors\.eu\/en(?:\/|\)|$)/);
  });

  it('uses bare canonical URLs while locale routing is disabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'false');
    vi.stubEnv('NEXT_PUBLIC_CARTOONS_SERVICE_ENABLED', 'true');

    const { buildLlmsTxt } = await import('../../../src/app/llms.txt/route.js');
    const body = buildLlmsTxt();

    expect(body).toContain('https://happycolors.eu/products');
    expect(body).toContain('https://happycolors.eu/gifts/gifts-for-children');
    expect(body).toContain('https://happycolors.eu/cartoons');
    expect(body).toContain('[Catalog](https://happycolors.eu/products)');
    expect(body).not.toMatch(/https:\/\/happycolors\.eu\/bg(?:\/|\)|$)/);
    expect(body).not.toMatch(/https:\/\/happycolors\.eu\/en(?:\/|\)|$)/);
  });

  it('keeps private paths out even if they are passed to the builder', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');

    const { buildLlmsTxt } = await import('../../../src/app/llms.txt/route.js');
    const body = buildLlmsTxt({
      locales: ['bg', 'en'],
      paths: [
        '/products',
        '/cartoons',
        '/analytics',
        '/api/products',
        '/cart',
        '/cartoon-orders/uploads',
        '/categories',
        '/checkout',
        '/home-banners',
        '/homepage-featured',
        '/newsletter/confirm',
        '/translations',
        '/users/login',
      ],
    });

    expect(body).toContain('https://happycolors.eu/bg/products');
    expect(body).toContain('https://happycolors.eu/en/products');
    expect(body).toContain('https://happycolors.eu/bg/cartoons');
    expect(body).toContain('https://happycolors.eu/en/cartoons');
    expect(body).not.toMatch(
      /\/analytics|\/api|\/cart(?:\/|\b)|\/cartoon-orders|\/categories|\/checkout|\/home-banners|\/homepage-featured|\/newsletter|\/translations|\/users/
    );
  });
});
