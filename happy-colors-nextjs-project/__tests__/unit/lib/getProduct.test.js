import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('getProduct', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.happycolors.eu/api');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('fetches and returns a product object', async () => {
    const product = { _id: 'product-1', title: 'Candle' };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => product,
      }))
    );

    const { getProduct } = await import('../../../src/lib/getProduct.js');

    await expect(getProduct('product-1')).resolves.toEqual(product);
    expect(fetch).toHaveBeenCalledWith('https://api.happycolors.eu/api/products/product-1', {
      cache: 'no-store',
    });
  });

  it('returns null for non-ok responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: false, json: vi.fn() })
    );

    const { getProduct } = await import('../../../src/lib/getProduct.js');

    await expect(getProduct('missing')).resolves.toBeNull();
  });

  it('returns null for invalid product payloads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: true, json: async () => null })
    );

    const { getProduct } = await import('../../../src/lib/getProduct.js');

    await expect(getProduct('invalid')).resolves.toBeNull();
  });

  it('logs and returns null when the request throws', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('network down');
    }));

    const { getProduct } = await import('../../../src/lib/getProduct.js');

    await expect(getProduct('broken')).resolves.toBeNull();
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('broken'),
      expect.any(Error)
    );
  });
});
