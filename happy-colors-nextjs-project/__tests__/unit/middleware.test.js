import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { LOCALE_REQUEST_HEADER } from '../../src/i18n/config.js';
import {
  ENGLISH_UNAVAILABLE_NOTICE_QUERY,
  ENGLISH_UNAVAILABLE_NOTICE_VALUE,
  config,
  isProtectedPagePath,
  isPublicLegacyPath,
  middleware,
  resolvePublicLocaleRedirect,
} from '../../src/middleware.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('middleware protected page paths', () => {
  it('protects owner-only pages before rendering the app shell', () => {
    expect(isProtectedPagePath('/newsletter/send')).toBe(true);
    expect(isProtectedPagePath('/products/create')).toBe(true);
    expect(isProtectedPagePath('/products/product-1/edit')).toBe(true);
    expect(isProtectedPagePath('/products/product-1/delete')).toBe(true);
    expect(isProtectedPagePath('/blog/article-1/edit')).toBe(true);
    expect(isProtectedPagePath('/categories')).toBe(true);
    expect(isProtectedPagePath('/translations')).toBe(true);
  });

  it('leaves public pages public', () => {
    expect(isProtectedPagePath('/')).toBe(false);
    expect(isProtectedPagePath('/products')).toBe(false);
    expect(isProtectedPagePath('/products/product-1')).toBe(false);
    expect(isProtectedPagePath('/blog')).toBe(false);
    expect(isProtectedPagePath('/contacts')).toBe(false);
  });
});

describe('middleware public locale redirects', () => {
  it('recognizes public legacy list and detail routes without owner-only routes', () => {
    expect(isPublicLegacyPath('/products')).toBe(true);
    expect(isPublicLegacyPath('/products/crochet-lion')).toBe(true);
    expect(isPublicLegacyPath('/blog/story-1')).toBe(true);
    expect(isPublicLegacyPath('/gifts')).toBe(true);
    expect(isPublicLegacyPath('/gifts/gifts-for-children')).toBe(true);
    expect(isPublicLegacyPath('/products/create')).toBe(false);
    expect(isPublicLegacyPath('/products/crochet-lion/edit')).toBe(false);
    expect(isPublicLegacyPath('/gifts/gifts-for-children/extra')).toBe(false);
  });

  it('strips explicit locale prefixes while routing is disabled and preserves safe query params', () => {
    expect(
      resolvePublicLocaleRedirect({
        pathname: '/en/products',
        search: '?category=toys&utm_source=ignored',
        localeRoutingEnabled: false,
      })
    ).toEqual({
      pathname: '/products',
      search: '?category=toys',
      status: 307,
      headers: {
        'Cache-Control': 'private, max-age=0, no-store',
      },
    });
  });

  it('permanently redirects public legacy routes to Bulgarian regardless of locale preferences', () => {
    expect(
      resolvePublicLocaleRedirect({
        pathname: '/faq',
        search: '?q=delivery&unsafe=ignored',
        localeRoutingEnabled: true,
        englishEnabled: true,
        savedLocale: 'en',
        countryCode: 'US',
      })
    ).toEqual({
      pathname: '/bg/faq',
      search: '?q=delivery',
      status: 308,
      headers: {},
    });
  });

  it('selects the root locale from saved choice, country, then Bulgarian fallback', () => {
    expect(
      resolvePublicLocaleRedirect({
        pathname: '/',
        search: '',
        localeRoutingEnabled: true,
        englishEnabled: true,
        countryCode: 'BG',
      })
    ).toEqual({
      pathname: '/bg',
      search: '',
      status: 307,
      headers: {
        'Cache-Control': 'private, max-age=0, no-store',
        Vary: 'Cookie, CF-IPCountry, X-Vercel-IP-Country, CloudFront-Viewer-Country',
      },
    });

    expect(
      resolvePublicLocaleRedirect({
        pathname: '/',
        search: '',
        localeRoutingEnabled: true,
        englishEnabled: true,
        countryCode: 'US',
      })
    ).toEqual({
      pathname: '/en',
      search: '',
      status: 307,
      headers: {
        'Cache-Control': 'private, max-age=0, no-store',
        Vary: 'Cookie, CF-IPCountry, X-Vercel-IP-Country, CloudFront-Viewer-Country',
      },
    });

    expect(
      resolvePublicLocaleRedirect({
        pathname: '/',
        localeRoutingEnabled: true,
        englishEnabled: true,
        savedLocale: 'bg',
        countryCode: 'US',
      })
    ).toEqual({
      pathname: '/bg',
      search: '',
      status: 307,
      headers: {
        'Cache-Control': 'private, max-age=0, no-store',
        Vary: 'Cookie, CF-IPCountry, X-Vercel-IP-Country, CloudFront-Viewer-Country',
      },
    });

    expect(
      resolvePublicLocaleRedirect({
        pathname: '/',
        localeRoutingEnabled: true,
        englishEnabled: true,
        savedLocale: 'fr',
        countryCode: '',
      })
    ).toMatchObject({
      pathname: '/bg',
      status: 307,
    });
  });

  it('never negotiates English while the English locale is disabled', () => {
    expect(
      resolvePublicLocaleRedirect({
        pathname: '/',
        localeRoutingEnabled: true,
        englishEnabled: false,
        savedLocale: 'en',
        countryCode: 'US',
      })
    ).toMatchObject({
      pathname: '/bg',
      status: 307,
    });
  });

  it('redirects disabled English routes to Bulgarian with a notice and token-safe headers', () => {
    expect(
      resolvePublicLocaleRedirect({
        pathname: '/en/newsletter/confirm',
        search: '?token=abc123&secret=ignored',
        localeRoutingEnabled: true,
        englishEnabled: false,
      })
    ).toEqual({
      pathname: '/bg/newsletter/confirm',
      search: `?token=abc123&${ENGLISH_UNAVAILABLE_NOTICE_QUERY}=${ENGLISH_UNAVAILABLE_NOTICE_VALUE}`,
      status: 307,
      headers: {
        'Cache-Control': 'private, max-age=0, no-store',
        'Referrer-Policy': 'no-referrer',
      },
    });
  });

  it('preserves token query params only for middleware redirects with token-safe headers', () => {
    expect(
      resolvePublicLocaleRedirect({
        pathname: '/newsletter/unsubscribe',
        search: '?token=abc123&utm_source=ignored',
        localeRoutingEnabled: true,
        englishEnabled: true,
      })
    ).toEqual({
      pathname: '/bg/newsletter/unsubscribe',
      search: '?token=abc123',
      status: 307,
      headers: {
        'Cache-Control': 'private, max-age=0, no-store',
        'Referrer-Policy': 'no-referrer',
      },
    });
  });

  it('treats newsletter preferences as a public token-safe legacy route', () => {
    expect(isPublicLegacyPath('/newsletter/preferences')).toBe(true);
    expect(
      resolvePublicLocaleRedirect({
        pathname: '/newsletter/preferences',
        search: '?token=abc123&utm_source=ignored',
        localeRoutingEnabled: true,
        englishEnabled: true,
      })
    ).toEqual({
      pathname: '/bg/newsletter/preferences',
      search: '?token=abc123',
      status: 307,
      headers: {
        'Cache-Control': 'private, max-age=0, no-store',
        'Referrer-Policy': 'no-referrer',
      },
    });
  });

  it('passes through already localized public routes and strips locale prefixes from non-public routes', () => {
    expect(
      resolvePublicLocaleRedirect({
        pathname: '/bg/products',
        localeRoutingEnabled: true,
        englishEnabled: true,
      })
    ).toBeNull();

    expect(
      resolvePublicLocaleRedirect({
        pathname: '/en/gifts',
        localeRoutingEnabled: true,
        englishEnabled: true,
      })
    ).toBeNull();

    expect(
      resolvePublicLocaleRedirect({
        pathname: '/en/gifts/gifts-for-children',
        localeRoutingEnabled: true,
        englishEnabled: true,
      })
    ).toBeNull();

    expect(
      resolvePublicLocaleRedirect({
        pathname: '/en/cart',
        search: '?updated=1',
        localeRoutingEnabled: true,
        englishEnabled: true,
      })
    ).toEqual({
      pathname: '/cart',
      search: '?updated=1',
      status: 307,
      headers: {
        'Cache-Control': 'private, max-age=0, no-store',
      },
    });
  });

  it('redirects disabled English gift routes to Bulgarian gift routes with a notice', () => {
    expect(
      resolvePublicLocaleRedirect({
        pathname: '/en/gifts/gifts-for-children',
        localeRoutingEnabled: true,
        englishEnabled: false,
      })
    ).toEqual({
      pathname: '/bg/gifts/gifts-for-children',
      search: `?${ENGLISH_UNAVAILABLE_NOTICE_QUERY}=${ENGLISH_UNAVAILABLE_NOTICE_VALUE}`,
      status: 307,
      headers: {
        'Cache-Control': 'private, max-age=0, no-store',
      },
    });
  });

  it('matches gift routes so locale middleware can serve them', () => {
    expect(config.matcher).toContain('/gifts/:path*');
  });
});

describe('middleware public locale integration', () => {
  it('reads root negotiation inputs without applying them to explicit localized URLs', () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');

    const rootRequest = new NextRequest('http://localhost:3000/', {
      headers: {
        'accept-language': 'en-US,en;q=0.9',
        cookie: 'happycolors_locale=bg',
        'cf-ipcountry': 'US',
      },
    });
    const rootResponse = middleware(rootRequest);

    expect(rootResponse.headers.get('location')).toBe('http://localhost:3000/bg');
    expect(rootResponse.headers.get('Cache-Control')).toBe('private, max-age=0, no-store');
    expect(rootResponse.headers.get('Vary')).toBe(
      'Cookie, CF-IPCountry, X-Vercel-IP-Country, CloudFront-Viewer-Country'
    );

    const invalidCookieResponse = middleware(
      new NextRequest('http://localhost:3000/', {
        headers: {
          'accept-language': 'en-US,en;q=0.9',
          cookie: 'happycolors_locale=fr',
          'cf-ipcountry': 'US',
        },
      })
    );

    expect(invalidCookieResponse.headers.get('location')).toBe('http://localhost:3000/en');

    const unknownCountryResponse = middleware(
      new NextRequest('http://localhost:3000/', {
        headers: {
          'accept-language': 'en-US,en;q=0.9',
        },
      })
    );

    expect(unknownCountryResponse.headers.get('location')).toBe('http://localhost:3000/bg');

    const explicitResponse = middleware(
      new NextRequest('http://localhost:3000/bg/products', {
        headers: {
          'accept-language': 'en-US,en;q=0.9',
          cookie: 'happycolors_locale=en',
          'cf-ipcountry': 'US',
        },
      })
    );

    expect(explicitResponse.headers.get('location')).toBeNull();
    expect(explicitResponse.headers.get(`x-middleware-request-${LOCALE_REQUEST_HEADER}`)).toBe('bg');
  });

  it('sets no-store token-page headers and injects the enabled path locale into request headers', () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');

    const response = middleware(new NextRequest('http://localhost:3000/en/newsletter/confirm'));

    expect(response.headers.get('Cache-Control')).toBe('private, max-age=0, no-store');
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(response.headers.get('x-middleware-override-headers')).toContain(LOCALE_REQUEST_HEADER);
    expect(response.headers.get(`x-middleware-request-${LOCALE_REQUEST_HEADER}`)).toBe('en');
  });

  it('sets no-store token-page headers for localized newsletter preferences pages', () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');

    const response = middleware(new NextRequest('http://localhost:3000/en/newsletter/preferences'));

    expect(response.headers.get('Cache-Control')).toBe('private, max-age=0, no-store');
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(response.headers.get(`x-middleware-request-${LOCALE_REQUEST_HEADER}`)).toBe('en');
  });
});
