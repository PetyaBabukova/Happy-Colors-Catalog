import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInvalidJsonRequest, createJsonRequest, readJson } from '../_helpers.js';

const revalidatePath = vi.fn();
const revalidateTag = vi.fn();
const requireApiAuth = vi.fn();
let authResult;

async function loadRoute() {
  return import('../../../src/app/api/revalidate/products/route.js');
}

describe('/api/revalidate/products', () => {
  beforeEach(() => {
    authResult = { ok: true, user: { _id: 'owner-1' } };
    requireApiAuth.mockImplementation(() => authResult);

    vi.doMock('../../../src/app/api/_lib/auth.js', () => ({
      requireApiAuth,
    }));
    vi.doMock('next/cache', () => ({
      revalidatePath,
      revalidateTag,
    }));
  });

  it('revalidates product list and detail paths', async () => {
    const { POST } = await loadRoute();

    const response = await POST(createJsonRequest({ productId: 'product-1' }));

    expect(response.status).toBe(200);
    await expect(readJson(response)).resolves.toEqual({ success: true });
    expect(revalidateTag).toHaveBeenCalledWith('products');
    expect(revalidatePath).toHaveBeenCalledWith('/products');
    expect(revalidatePath).toHaveBeenCalledWith('/products/product-1');
  });

  it('rejects unauthenticated requests', async () => {
    authResult = { ok: false, status: 401, message: 'Missing authentication token.' };
    const { POST } = await loadRoute();

    const response = await POST(createJsonRequest({ productId: 'product-1' }));

    expect(response.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('still revalidates product list for invalid JSON', async () => {
    const { POST } = await loadRoute();

    const response = await POST(createInvalidJsonRequest());

    expect(response.status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledWith('products');
    expect(revalidatePath).toHaveBeenCalledWith('/products');
    expect(revalidatePath).not.toHaveBeenCalledWith('/products/undefined');
  });

  it('returns 500 when auth validation throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    requireApiAuth.mockImplementationOnce(() => {
      throw new Error('JWT_SECRET missing');
    });
    const { POST } = await loadRoute();

    const response = await POST(createJsonRequest({ productId: 'product-1' }));

    expect(response.status).toBe(500);
    expect(revalidateTag).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
