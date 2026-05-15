import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInvalidJsonRequest, createJsonRequest, readJson } from '../_helpers.js';

const revalidatePath = vi.fn();
const revalidateTag = vi.fn();
const requireApiAuth = vi.fn();
let authResult;

async function loadRoute() {
  return import('../../../src/app/api/revalidate/blog/route.js');
}

describe('/api/revalidate/blog', () => {
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

  it('rejects unauthenticated requests', async () => {
    authResult = { ok: false, status: 401, message: 'Missing authentication token.' };
    const { POST } = await loadRoute();

    await expect(POST(createJsonRequest({ articleId: 'a'.repeat(24) }))).resolves.toMatchObject({
      status: 401,
    });
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it.each([undefined, '', 'bad-id', '../foo', 'evil/path'])('rejects malformed articleId %s', async (articleId) => {
    const { POST } = await loadRoute();

    await expect(POST(createJsonRequest({ articleId }))).resolves.toMatchObject({ status: 400 });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON requests', async () => {
    const { POST } = await loadRoute();

    await expect(POST(createInvalidJsonRequest())).resolves.toMatchObject({ status: 400 });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('revalidates blog tag, index, detail, and sitemap', async () => {
    const articleId = 'a'.repeat(24);
    const { POST } = await loadRoute();

    const response = await POST(createJsonRequest({ articleId }));

    expect(response.status).toBe(200);
    await expect(readJson(response)).resolves.toEqual({ success: true });
    expect(revalidateTag).toHaveBeenCalledWith('blog-articles');
    expect(revalidatePath).toHaveBeenCalledWith('/blog');
    expect(revalidatePath).toHaveBeenCalledWith(`/blog/${articleId}`);
    expect(revalidatePath).toHaveBeenCalledWith('/sitemap.xml');
  });

  it('rate limits repeated authenticated revalidation requests', async () => {
    const articleId = 'a'.repeat(24);
    const { POST, resetBlogRevalidateRateLimit } = await loadRoute();
    resetBlogRevalidateRateLimit();

    for (let index = 0; index < 60; index += 1) {
      await expect(POST(createJsonRequest({ articleId }))).resolves.toMatchObject({ status: 200 });
    }

    const rateLimitedResponse = await POST(createJsonRequest({ articleId }));

    expect(rateLimitedResponse.status).toBe(429);
    expect(rateLimitedResponse.headers.get('Retry-After')).toBeTruthy();
  });
});
