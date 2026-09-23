import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getServerPublicHref,
  getServerRedirectHref,
} from '../../../src/i18n/serverNavigation';

describe('server locale navigation helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('keeps public hrefs bare while locale routing is disabled', () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'false');

    expect(getServerPublicHref('/products?category=candles', 'en')).toBe(
      '/products?category=candles'
    );
  });

  it('localizes public hrefs and filters unsafe query params when routing is enabled', () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');

    expect(getServerPublicHref('/contacts?service=cartoons&next=https://evil.test', 'en')).toBe(
      '/en/contacts?service=cartoons'
    );
    expect(getServerPublicHref('/products', '')).toBe('/products');
    expect(getServerPublicHref('/products', 'fr')).toBe('/products');
  });

  it('localizes redirect paths without filtering already-approved tracking params', () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');

    expect(
      getServerRedirectHref(
        '/products?category=crochet-animals&utm_campaign=summer',
        'en'
      )
    ).toBe('/en/products?category=crochet-animals&utm_campaign=summer');
  });

  it('keeps redirect targets bare while locale routing is disabled', () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'false');

    expect(
      getServerRedirectHref('/products?category=crochet-animals&utm_campaign=summer', 'en')
    ).toBe('/products?category=crochet-animals&utm_campaign=summer');
  });
});
