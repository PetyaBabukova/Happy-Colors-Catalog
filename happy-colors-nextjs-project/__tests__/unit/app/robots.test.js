import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('robots', () => {
  const privateProductionDisallowPaths = [
    '/analytics',
    '/api/',
    '/cart$',
    '/cart?',
    '/cart/',
    '/cartoon-orders',
    '/categories',
    '/checkout',
    '/home-banners',
    '/homepage-featured',
    '/newsletter',
    '/products/create',
    '/products/*/delete',
    '/products/*/edit',
    '/translations',
    '/users',
  ];

  function isPathDisallowedByRule(path, disallowPath) {
    return disallowPath.endsWith('$')
      ? path === disallowPath.slice(0, -1)
      : path.startsWith(disallowPath);
  }

  function isPathDisallowed(path, disallowPaths = privateProductionDisallowPaths) {
    return disallowPaths.some((disallowPath) => isPathDisallowedByRule(path, disallowPath));
  }

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
      rules: [
        {
          userAgent: '*',
          allow: '/',
          disallow: privateProductionDisallowPaths,
        },
        {
          userAgent: 'OAI-SearchBot',
          allow: '/',
          disallow: privateProductionDisallowPaths,
        },
        {
          userAgent: 'ChatGPT-User',
          allow: '/',
          disallow: privateProductionDisallowPaths,
        },
      ],
      host: 'https://happycolors.eu',
      sitemap: 'https://happycolors.eu/sitemap.xml',
    });
  });

  it('disallows private and transactional paths while leaving public catalog paths crawlable', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://happycolors.eu');

    const { default: robots } = await import('../../../src/app/robots.js');
    const defaultRule = robots().rules[0];

    expect(defaultRule.allow).toBe('/');
    expect(defaultRule.disallow).toContain('/api/');
    expect(defaultRule.disallow).toContain('/checkout');
    expect(defaultRule.disallow).toContain('/cart$');
    expect(defaultRule.disallow).toContain('/cart?');
    expect(defaultRule.disallow).toContain('/cart/');
    expect(defaultRule.disallow).toContain('/products/create');
    expect(defaultRule.disallow).toContain('/products/*/edit');
    expect(isPathDisallowed('/cart', defaultRule.disallow)).toBe(true);
    expect(isPathDisallowed('/cart?ref=nav', defaultRule.disallow)).toBe(true);
    expect(isPathDisallowed('/cart/items', defaultRule.disallow)).toBe(true);
    expect(isPathDisallowed('/cartoons', defaultRule.disallow)).toBe(false);
    expect(isPathDisallowed('/cartoons/offer', defaultRule.disallow)).toBe(false);
    expect(isPathDisallowed('/products', defaultRule.disallow)).toBe(false);
    expect(defaultRule.disallow).not.toContain('/products');
    expect(defaultRule.disallow).not.toContain('/gifts');
    expect(defaultRule.disallow).not.toContain('/blog');
  });

  it('keeps explicit AI search crawler production rules aligned with the default public rule', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://happycolors.eu');

    const { default: robots } = await import('../../../src/app/robots.js');
    const { rules } = robots();
    const [defaultRule, ...namedRules] = rules;

    expect(defaultRule.userAgent).toBe('*');
    expect(namedRules.map((rule) => rule.userAgent)).toEqual(['OAI-SearchBot', 'ChatGPT-User']);
    for (const rule of namedRules) {
      expect({ ...rule, userAgent: '*' }).toEqual(defaultRule);
    }
  });

  it('does not over-grant named AI search crawlers outside production', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_ENV', 'preview');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://happy-colors-preview.onrender.com');

    const { default: robots } = await import('../../../src/app/robots.js');

    expect(robots()).toEqual({
      rules: {
        userAgent: '*',
        disallow: '/',
      },
      host: 'https://happy-colors-preview.onrender.com',
    });
    expect(JSON.stringify(robots().rules)).not.toContain('OAI-SearchBot');
    expect(JSON.stringify(robots().rules)).not.toContain('ChatGPT-User');
    expect(robots()).not.toHaveProperty('sitemap');
  });
});
