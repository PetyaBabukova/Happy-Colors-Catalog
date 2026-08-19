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
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');

    const { GET } = await import('../../../src/app/llms.txt/route.js');
    const response = GET();
    const body = await response.text();

    expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    expect(body).toContain('# Happy Colors');
    expect(body).toContain('https://happycolors.eu/bg');
    expect(body).toContain('https://happycolors.eu/en');
    expect(body).toContain('https://happycolors.eu/bg/gifts');
    expect(body).toContain('https://happycolors.eu/en/gifts/gifts-for-children');
    expect(body).toContain('https://happycolors.eu/sitemap.xml');
    expect(body).not.toMatch(/localhost|preview|onrender|vercel|netlify|podaraci/i);
    expect(body).not.toMatch(/\/api|\/admin|\/cart(?:\/|\b)|\/cartoon-orders|\/checkout|\/users/);
    expect(body).not.toMatch(/facebook|instagram|etsy/i);
  });

  it('keeps private paths out even if they are passed to the builder', async () => {
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');

    const { buildLlmsTxt } = await import('../../../src/app/llms.txt/route.js');
    const body = buildLlmsTxt({
      locales: ['bg', 'en'],
      paths: ['/products', '/api/products', '/cart', '/cartoon-orders/uploads', '/checkout', '/users/login'],
    });

    expect(body).toContain('https://happycolors.eu/bg/products');
    expect(body).toContain('https://happycolors.eu/en/products');
    expect(body).not.toMatch(/\/api|\/cart(?:\/|\b)|\/cartoon-orders|\/checkout|\/users/);
  });
});
