import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { revalidateProductSurfaces } from '../../../helpers/revalidateProducts.js';

describe('revalidateProductSurfaces', () => {
  beforeEach(() => {
    vi.stubEnv('CLIENT_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    vi.stubEnv('NEWSLETTER_PUBLIC_SITE_URL', '');
    vi.stubEnv('PUBLIC_SITE_URL', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('skips missing revalidation configuration outside production', async () => {
    vi.stubEnv('NODE_ENV', 'test');

    await expect(revalidateProductSurfaces({ productId: 'product-1' })).resolves.toEqual({
      skipped: true,
    });
  });

  it('fails loudly when production revalidation is not configured', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    await expect(revalidateProductSurfaces({ productId: 'product-1' })).rejects.toThrow(
      'Product revalidation is not configured.'
    );
  });

  it('posts to the configured revalidation endpoint with the shared secret', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('PRODUCT_REVALIDATE_URL', 'https://happycolors.example/api/revalidate/products');
    vi.stubEnv('PRODUCT_REVALIDATE_SECRET', 'secret');

    await expect(revalidateProductSurfaces({ productId: 'product-1' })).resolves.toEqual({
      ok: true,
      results: [
        {
          url: 'https://happycolors.example/api/revalidate/products',
          ok: true,
          status: 200,
        },
      ],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://happycolors.example/api/revalidate/products',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-revalidate-secret': 'secret',
        },
        body: JSON.stringify({ productId: 'product-1' }),
      })
    );
  });

  it('revalidates both local client and public site urls when they are configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('CLIENT_URL', 'http://localhost:3000');
    vi.stubEnv('NEWSLETTER_PUBLIC_SITE_URL', 'https://happycolors.eu');
    vi.stubEnv('PRODUCT_REVALIDATE_SECRET', 'secret');

    await expect(revalidateProductSurfaces({ productId: 'product-1' })).resolves.toEqual({
      ok: true,
      results: [
        {
          url: 'http://localhost:3000/api/revalidate/products',
          ok: true,
          status: 200,
        },
        {
          url: 'https://happycolors.eu/api/revalidate/products',
          ok: true,
          status: 200,
        },
      ],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
