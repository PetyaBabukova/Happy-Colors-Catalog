import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInvalidJsonRequest, createJsonRequest, readJson } from '../_helpers.js';

const revalidatePath = vi.fn();
const revalidateTag = vi.fn();
const requireApiAuth = vi.fn();
const requireApiActiveArtistOrFullAdmin = vi.fn();
let authResult;

async function loadRoute() {
  return import('../../../src/app/api/revalidate/products/route.js');
}

describe('/api/revalidate/products', () => {
  const validProductId = '507f1f77bcf86cd799439011';

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    authResult = { ok: true, user: { _id: 'owner-1', role: 'full_admin' } };
    requireApiAuth.mockImplementation(() => authResult);
    requireApiActiveArtistOrFullAdmin.mockImplementation((auth) =>
      auth.ok &&
      auth.user?.role !== 'full_admin' &&
      !(auth.user?.role === 'artist' && auth.user?.artistStatus !== 'suspended')
        ? { ok: false, status: 403, message: 'Forbidden.' }
        : auth
    );

    vi.doMock('../../../src/app/api/_lib/auth.js', () => ({
      requireApiAuth,
      requireApiActiveArtistOrFullAdmin,
      requireApiFullAdmin: vi.fn((auth) =>
        auth.ok && auth.user?.role !== 'full_admin'
          ? { ok: false, status: 403, message: 'Forbidden.' }
          : auth
      ),
    }));
    vi.doMock('next/cache', () => ({
      revalidatePath,
      revalidateTag,
    }));
  });

  it('revalidates product list and detail paths', async () => {
    const { POST } = await loadRoute();

    const response = await POST(createJsonRequest({ productId: validProductId }));

    expect(response.status).toBe(200);
    await expect(readJson(response)).resolves.toEqual({ success: true });
    expect(revalidateTag).toHaveBeenCalledWith('products');
    expect(revalidateTag).toHaveBeenCalledWith('categories');
    expect(revalidateTag).toHaveBeenCalledWith('visible-categories');
    expect(revalidateTag).toHaveBeenCalledWith('homepage-featured-products');
    expect(revalidateTag).toHaveBeenCalledWith('cartoon-gallery-products');
    expect(revalidatePath).toHaveBeenCalledWith('/products');
    expect(revalidatePath).toHaveBeenCalledWith('/bg/products');
    expect(revalidatePath).toHaveBeenCalledWith('/en/products');
    expect(revalidatePath).toHaveBeenCalledWith('/');
    expect(revalidatePath).toHaveBeenCalledWith('/bg');
    expect(revalidatePath).toHaveBeenCalledWith('/en');
    expect(revalidatePath).toHaveBeenCalledWith('/cartoons');
    expect(revalidatePath).toHaveBeenCalledWith('/bg/cartoons');
    expect(revalidatePath).toHaveBeenCalledWith('/en/cartoons');
    expect(revalidatePath).toHaveBeenCalledWith('/sitemap.xml');
    expect(revalidatePath).toHaveBeenCalledWith(`/products/${validProductId}`);
    expect(revalidatePath).toHaveBeenCalledWith(`/bg/products/${validProductId}`);
    expect(revalidatePath).toHaveBeenCalledWith(`/en/products/${validProductId}`);
  });

  it('accepts server-owned revalidation with the shared secret', async () => {
    vi.stubEnv('PRODUCT_REVALIDATE_SECRET', 'server-secret');
    const { POST } = await loadRoute();

    const response = await POST(
      createJsonRequest(
        { productId: validProductId },
        { headers: { get: (name) => (name === 'x-revalidate-secret' ? 'server-secret' : null) } }
      )
    );

    expect(response.status).toBe(200);
    expect(requireApiAuth).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith(`/products/${validProductId}`);
    expect(revalidatePath).toHaveBeenCalledWith(`/bg/products/${validProductId}`);
    expect(revalidatePath).toHaveBeenCalledWith(`/en/products/${validProductId}`);
  });

  it('accepts active artist revalidation for product mutation freshness', async () => {
    authResult = {
      ok: true,
      user: { _id: 'artist-1', role: 'artist', artistStatus: 'active' },
    };
    const { POST } = await loadRoute();

    const response = await POST(createJsonRequest({ productId: validProductId }));

    expect(response.status).toBe(200);
    expect(requireApiActiveArtistOrFullAdmin).toHaveBeenCalledWith(authResult);
    expect(revalidateTag).toHaveBeenCalledWith('products');
    expect(revalidatePath).toHaveBeenCalledWith('/en/products');
  });

  it('rejects invalid product ids before revalidating detail paths', async () => {
    const { POST } = await loadRoute();

    const response = await POST(createJsonRequest({ productId: '../admin' }));

    expect(response.status).toBe(400);
    await expect(readJson(response)).resolves.toEqual({ message: 'Invalid productId.' });
    expect(revalidateTag).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects invalid product ids on the shared-secret path too', async () => {
    vi.stubEnv('PRODUCT_REVALIDATE_SECRET', 'server-secret');
    const { POST } = await loadRoute();

    const response = await POST(
      createJsonRequest(
        { productId: '../admin' },
        { headers: { get: (name) => (name === 'x-revalidate-secret' ? 'server-secret' : null) } }
      )
    );

    expect(response.status).toBe(400);
    expect(requireApiAuth).not.toHaveBeenCalled();
    expect(revalidateTag).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
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
    expect(revalidateTag).toHaveBeenCalledWith('categories');
    expect(revalidateTag).toHaveBeenCalledWith('visible-categories');
    expect(revalidateTag).toHaveBeenCalledWith('homepage-featured-products');
    expect(revalidateTag).toHaveBeenCalledWith('cartoon-gallery-products');
    expect(revalidatePath).toHaveBeenCalledWith('/products');
    expect(revalidatePath).toHaveBeenCalledWith('/bg/products');
    expect(revalidatePath).toHaveBeenCalledWith('/en/products');
    expect(revalidatePath).toHaveBeenCalledWith('/');
    expect(revalidatePath).toHaveBeenCalledWith('/bg');
    expect(revalidatePath).toHaveBeenCalledWith('/en');
    expect(revalidatePath).toHaveBeenCalledWith('/cartoons');
    expect(revalidatePath).toHaveBeenCalledWith('/bg/cartoons');
    expect(revalidatePath).toHaveBeenCalledWith('/en/cartoons');
    expect(revalidatePath).toHaveBeenCalledWith('/sitemap.xml');
    expect(revalidatePath).not.toHaveBeenCalledWith('/products/undefined');
  });

  it('revalidates tag/list surfaces without detail paths when productId is omitted', async () => {
    const { POST } = await loadRoute();

    const response = await POST(createJsonRequest({}));

    expect(response.status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledWith('products');
    expect(revalidateTag).toHaveBeenCalledWith('categories');
    expect(revalidateTag).toHaveBeenCalledWith('visible-categories');
    expect(revalidatePath).toHaveBeenCalledWith('/products');
    expect(revalidatePath).toHaveBeenCalledWith('/bg/products');
    expect(revalidatePath).toHaveBeenCalledWith('/en/products');
    expect(revalidatePath).not.toHaveBeenCalledWith(expect.stringMatching(/^\/products\/.+/));
    expect(revalidatePath).not.toHaveBeenCalledWith(expect.stringMatching(/^\/bg\/products\/.+/));
    expect(revalidatePath).not.toHaveBeenCalledWith(expect.stringMatching(/^\/en\/products\/.+/));
  });

  it('returns 500 when auth validation throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    requireApiAuth.mockImplementationOnce(() => {
      throw new Error('JWT_SECRET missing');
    });
    const { POST } = await loadRoute();

    const response = await POST(createJsonRequest({ productId: validProductId }));

    expect(response.status).toBe(500);
    expect(revalidateTag).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
