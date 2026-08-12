import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApiUrl, getPublicServerFetchOptions } from '../../../src/managers/requestUtils.js';

describe('manager request utils', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds API urls with only meaningful query params', () => {
    expect(
      buildApiUrl('/api', '/products', {
        locale: 'en',
        category: '',
        page: 2,
        optional: null,
      })
    ).toBe('/api/products?locale=en&page=2');
  });

  it('uses ISR metadata on the server', () => {
    expect(getPublicServerFetchOptions({ tags: ['products'] })).toEqual({
      next: {
        revalidate: 60,
        tags: ['products'],
      },
    });
  });

  it('uses no-store in the browser only when requested', () => {
    vi.stubGlobal('window', {});

    expect(getPublicServerFetchOptions({ tags: ['products'] })).toEqual({ cache: 'no-store' });
    expect(
      getPublicServerFetchOptions({ tags: ['home-banners'], browserNoStore: false })
    ).toEqual({
      next: {
        revalidate: 60,
        tags: ['home-banners'],
      },
    });
  });
});
