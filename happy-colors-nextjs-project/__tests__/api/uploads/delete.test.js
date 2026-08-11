import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInvalidJsonRequest, createJsonRequest, readJson } from '../_helpers.js';

const authUser = { _id: 'user-1', role: 'full_admin' };
const deleteFile = vi.fn();
const file = vi.fn(() => ({ delete: deleteFile }));
const bucket = vi.fn(() => ({ file }));
const getStorage = vi.fn(() => ({ bucket }));
const verifyUploadDeleteToken = vi.fn(() => ({ ok: true }));
const productFindOne = vi.fn();
const blogArticleFindOne = vi.fn();
const homeBannerFindOne = vi.fn();
const collection = vi.fn((name) => ({
  findOne:
    name === 'blogarticles'
      ? blogArticleFindOne
      : name === 'homebanners'
        ? homeBannerFindOne
        : productFindOne,
}));
const connectToMongo = vi.fn(() =>
  Promise.resolve({
    connection: {
      db: {
        collection,
      },
    },
  })
);
let authResult;
let bucketName;

async function loadRoute() {
  return import('../../../src/app/api/uploads/delete/route.js');
}

describe('/api/uploads/delete', () => {
  beforeEach(() => {
    authResult = { ok: true, user: authUser };
    bucketName = 'test-bucket';
    deleteFile.mockResolvedValue(undefined);
    collection.mockClear();
    productFindOne.mockResolvedValue(null);
    blogArticleFindOne.mockResolvedValue(null);
    homeBannerFindOne.mockResolvedValue(null);

    vi.doMock('../../../src/app/api/_lib/auth.js', () => ({
      requireApiAuth: vi.fn(() => authResult),
      requireApiFullAdmin: vi.fn((auth) =>
        auth.ok && auth.user?.role !== 'full_admin'
          ? { ok: false, status: 403, message: 'Forbidden.' }
          : auth
      ),
      requireApiActiveArtistOrFullAdmin: vi.fn((auth) =>
        auth.ok && auth.user?.role !== 'full_admin' && !(auth.user?.role === 'artist' && auth.user?.artistStatus === 'active')
          ? { ok: false, status: 403, message: 'Forbidden.' }
          : auth
      ),
    }));
    vi.doMock('../../../src/app/api/_lib/gcs.js', () => ({
      createPublicUrl: vi.fn(
        (bucketNameValue, objectName) => `https://storage.googleapis.com/${bucketNameValue}/${objectName}`
      ),
      getBucketName: vi.fn(() => bucketName),
      getStorage,
    }));
    vi.doMock('../../../src/app/api/_lib/mongo.js', () => ({
      connectToMongo,
    }));
    vi.doMock('../../../src/app/api/_lib/uploadDeleteToken.js', () => ({
      verifyUploadDeleteToken,
    }));
  });

  it('deletes unattached uploads with a valid delete token', async () => {
    const { POST } = await loadRoute();

    const response = await POST(
      createJsonRequest({
        objectName: 'products/videos/test-video.mp4',
        deleteToken: 'valid-token',
      })
    );

    expect(response.status).toBe(200);
    await expect(readJson(response)).resolves.toEqual({ ok: true });
    expect(verifyUploadDeleteToken).toHaveBeenCalledWith({
      token: 'valid-token',
      objectName: 'products/videos/test-video.mp4',
      userId: 'user-1',
    });
    expect(file).toHaveBeenCalledWith('products/videos/test-video.mp4');
    expect(deleteFile).toHaveBeenCalledWith({ ignoreNotFound: true });
  });

  it('deletes unattached blog image uploads with a valid delete token', async () => {
    const { POST } = await loadRoute();

    const response = await POST(
      createJsonRequest({
        objectName: 'blog/articles/thumbnails/article.webp',
        deleteToken: 'valid-token',
      })
    );

    expect(response.status).toBe(200);
    expect(verifyUploadDeleteToken).toHaveBeenCalledWith({
      token: 'valid-token',
      objectName: 'blog/articles/thumbnails/article.webp',
      userId: 'user-1',
    });
    expect(file).toHaveBeenCalledWith('blog/articles/thumbnails/article.webp');
  });

  it('deletes unattached product image uploads with a valid delete token', async () => {
    authResult = { ok: true, user: { _id: 'artist-1', role: 'artist', artistStatus: 'active' } };
    const { POST } = await loadRoute();

    const response = await POST(
      createJsonRequest({
        objectName: 'products/images/product.webp',
        deleteToken: 'valid-token',
      })
    );

    expect(response.status).toBe(200);
    expect(verifyUploadDeleteToken).toHaveBeenCalledWith({
      token: 'valid-token',
      objectName: 'products/images/product.webp',
      userId: 'artist-1',
    });
    expect(file).toHaveBeenCalledWith('products/images/product.webp');
  });

  it('deletes unattached home banner uploads with a valid full admin delete token', async () => {
    const { POST } = await loadRoute();

    const response = await POST(
      createJsonRequest({
        objectName: 'home-banners/images/banner.webp',
        deleteToken: 'valid-token',
      })
    );

    expect(response.status).toBe(200);
    expect(file).toHaveBeenCalledWith('home-banners/images/banner.webp');
  });

  it('requires full admin access for home banner upload rollback deletes', async () => {
    authResult = { ok: true, user: { _id: 'artist-1', role: 'artist', artistStatus: 'active' } };
    const { POST } = await loadRoute();

    const response = await POST(
      createJsonRequest({
        objectName: 'home-banners/images/banner.webp',
        deleteToken: 'valid-token',
      })
    );

    expect(response.status).toBe(403);
    expect(deleteFile).not.toHaveBeenCalled();
  });

  it('rejects unauthorized requests', async () => {
    authResult = { ok: false, status: 401, message: 'Missing authentication token.' };
    const { POST } = await loadRoute();

    expect(await POST(createJsonRequest({}))).toMatchObject({ status: 401 });
  });

  it('rejects malformed JSON', async () => {
    const { POST } = await loadRoute();

    await expect(POST(createInvalidJsonRequest())).resolves.toMatchObject({ status: 400 });
  });

  it.each([
    '../secrets.txt',
    '/etc/passwd',
    'uploads/other/file.mp4',
    'products/videos/./../../secrets.txt',
  ])('rejects invalid storage object name %s', async (objectName) => {
    const { POST } = await loadRoute();

    await expect(
      POST(createJsonRequest({ objectName, deleteToken: 'valid-token' }))
    ).resolves.toMatchObject({ status: 400 });
  });

  it('rejects invalid delete tokens', async () => {
    const { POST } = await loadRoute();

    verifyUploadDeleteToken.mockReturnValueOnce({ ok: false });
    await expect(
      POST(createJsonRequest({ objectName: 'products/videos/test-video.mp4', deleteToken: 'bad-token' }))
    ).resolves.toMatchObject({ status: 403 });
    expect(deleteFile).not.toHaveBeenCalled();
  });

  it('rejects assets already attached to products', async () => {
    const { POST } = await loadRoute();

    productFindOne.mockResolvedValueOnce({ _id: 'product-1' });
    await expect(
      POST(createJsonRequest({ objectName: 'products/posters/poster.webp', deleteToken: 'valid-token' }))
    ).resolves.toMatchObject({ status: 409 });
    expect(deleteFile).not.toHaveBeenCalled();
  });

  it('rejects assets already attached to blog articles', async () => {
    const { POST } = await loadRoute();

    blogArticleFindOne.mockResolvedValueOnce({ _id: 'blog-article-1' });
    await expect(
      POST(createJsonRequest({ objectName: 'blog/articles/hero/article.webp', deleteToken: 'valid-token' }))
    ).resolves.toMatchObject({ status: 409 });
    expect(deleteFile).not.toHaveBeenCalled();
  });

  it('rejects thumbnail assets already attached to blog articles', async () => {
    const { POST } = await loadRoute();

    blogArticleFindOne.mockResolvedValueOnce({ _id: 'blog-article-1' });
    await expect(
      POST(
        createJsonRequest({
          objectName: 'blog/articles/thumbnails/article.webp',
          deleteToken: 'valid-token',
        })
      )
    ).resolves.toMatchObject({ status: 409 });
    expect(deleteFile).not.toHaveBeenCalled();
  });

  it('rejects assets already attached to home banners', async () => {
    const { POST } = await loadRoute();

    homeBannerFindOne.mockResolvedValueOnce({ _id: 'banner-1' });
    await expect(
      POST(createJsonRequest({ objectName: 'home-banners/mobile-images/banner.webp', deleteToken: 'valid-token' }))
    ).resolves.toMatchObject({ status: 409 });
    expect(deleteFile).not.toHaveBeenCalled();
  });

  it('returns 500 when bucket config is missing', async () => {
    bucketName = '';
    const { POST } = await loadRoute();

    await expect(
      POST(createJsonRequest({ objectName: 'products/videos/test-video.mp4', deleteToken: 'valid-token' }))
    ).resolves.toMatchObject({ status: 500 });
  });

  it('returns 500 when storage deletion fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    deleteFile.mockRejectedValueOnce(new Error('gcs failed'));
    const { POST } = await loadRoute();

    await expect(
      POST(createJsonRequest({ objectName: 'products/videos/test-video.mp4', deleteToken: 'valid-token' }))
    ).resolves.toMatchObject({ status: 500 });
  });
});
