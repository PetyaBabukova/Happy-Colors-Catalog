import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkProductAccess } from '../../../src/utils/checkProductAccess.js';

describe('checkProductAccess', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns product access when the user owns the product', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ _id: 'product-1', owner: 'user-1' }),
      })
    );

    await expect(checkProductAccess('product-1', { _id: 'user-1' })).resolves.toEqual({
      product: { _id: 'product-1', owner: 'user-1' },
      unauthorized: false,
    });
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/products/mine/product-1'), {
      cache: 'no-store',
      credentials: 'include',
    });
  });

  it('returns unauthorized for non-ok responses or non-owners', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ _id: 'product-1', owner: 'owner-1' }),
      })
    );

    await expect(checkProductAccess('missing', { _id: 'user-1' })).resolves.toEqual({
      product: null,
      unauthorized: true,
    });
    await expect(checkProductAccess('product-1', { _id: 'user-1' })).resolves.toEqual({
      product: { _id: 'product-1', owner: 'owner-1' },
      unauthorized: true,
    });
  });

  it('returns error when fetch or JSON parsing fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));

    await expect(checkProductAccess('product-1', { _id: 'user-1' })).resolves.toEqual({
      product: null,
      unauthorized: false,
      error: true,
    });
  });
});
