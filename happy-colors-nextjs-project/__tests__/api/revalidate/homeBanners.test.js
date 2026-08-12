import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInvalidJsonRequest, createJsonRequest, readJson } from '../_helpers.js';

const revalidatePath = vi.fn();
const revalidateTag = vi.fn();
const requireApiAuth = vi.fn();
let authResult;

async function loadRoute() {
  return import('../../../src/app/api/revalidate/home-banners/route.js');
}

describe('/api/revalidate/home-banners', () => {
  beforeEach(() => {
    authResult = { ok: true, user: { _id: 'owner-1', role: 'full_admin' } };
    requireApiAuth.mockImplementation(() => authResult);

    vi.doMock('../../../src/app/api/_lib/auth.js', () => ({
      requireApiAuth,
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

  it('revalidates the homepage banner tag and homepage path', async () => {
    const { POST } = await loadRoute();

    const response = await POST(createJsonRequest({}));

    expect(response.status).toBe(200);
    await expect(readJson(response)).resolves.toEqual({ success: true });
    expect(revalidateTag).toHaveBeenCalledWith('home-banners');
    expect(revalidatePath).toHaveBeenCalledWith('/');
    expect(revalidatePath).toHaveBeenCalledWith('/bg');
    expect(revalidatePath).toHaveBeenCalledWith('/en');
  });

  it('revalidates when the caller posts without a JSON body', async () => {
    const { POST } = await loadRoute();

    const response = await POST(createInvalidJsonRequest());

    expect(response.status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledWith('home-banners');
    expect(revalidatePath).toHaveBeenCalledWith('/');
    expect(revalidatePath).toHaveBeenCalledWith('/bg');
    expect(revalidatePath).toHaveBeenCalledWith('/en');
  });

  it('requires auth before accepting a bodyless revalidation request', async () => {
    authResult = { ok: false, status: 401, message: 'Missing authentication token.' };
    const { POST } = await loadRoute();

    const response = await POST(
      createInvalidJsonRequest({
        headers: {
          get: (name) => (String(name).toLowerCase() === 'x-revalidate-secret' ? 'ignored-secret' : null),
        },
      })
    );

    expect(response.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('allows internal revalidation requests with the configured secret', async () => {
    vi.stubEnv('HOME_BANNER_REVALIDATE_SECRET', 'server-secret');
    authResult = { ok: false, status: 401, message: 'Missing authentication token.' };
    const { POST } = await loadRoute();

    const response = await POST(
      createInvalidJsonRequest({
        headers: {
          get: (name) => (String(name).toLowerCase() === 'x-revalidate-secret' ? 'server-secret' : null),
        },
      })
    );

    expect(response.status).toBe(200);
    expect(revalidateTag).toHaveBeenCalledWith('home-banners');
    expect(revalidatePath).toHaveBeenCalledWith('/');
    expect(revalidatePath).toHaveBeenCalledWith('/bg');
    expect(revalidatePath).toHaveBeenCalledWith('/en');
  });

  it('rejects unauthenticated requests', async () => {
    authResult = { ok: false, status: 401, message: 'Missing authentication token.' };
    const { POST } = await loadRoute();

    const response = await POST(createJsonRequest({}));

    expect(response.status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns 500 when auth validation throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    requireApiAuth.mockImplementationOnce(() => {
      throw new Error('JWT_SECRET missing');
    });
    const { POST } = await loadRoute();

    const response = await POST(createJsonRequest({}));

    expect(response.status).toBe(500);
    expect(revalidateTag).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
