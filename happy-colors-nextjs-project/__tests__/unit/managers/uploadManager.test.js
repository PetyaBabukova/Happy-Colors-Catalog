import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteSignedUploadedFile,
  uploadBlogArticleImage,
  uploadImageToBucket,
  uploadImagesToBucket,
  uploadSignedFile,
} from '../../../src/managers/uploadManager.js';

function jsonResponse({ ok = true, body = {} } = {}) {
  return {
    ok,
    json: vi.fn().mockResolvedValue(body),
  };
}

function buildFile({ name = 'candle.webp', size = 128, type = 'image/webp' } = {}) {
  return new File(['test-content'], name, { type, lastModified: 1, endings: 'transparent' });
}

describe('uploadManager', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('requires a selected image file before uploading to the legacy route', async () => {
    await expect(uploadImageToBucket()).rejects.toThrow('Не е избран файл.');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('uploads one image through the legacy upload route and returns imageUrl', async () => {
    const file = buildFile();
    fetch.mockResolvedValueOnce(jsonResponse({ body: { imageUrl: 'https://cdn.test/candle.webp' } }));

    await expect(uploadImageToBucket(file)).resolves.toBe('https://cdn.test/candle.webp');

    expect(fetch).toHaveBeenCalledWith(
      '/api/upload-image',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      })
    );
  });

  it('returns uploaded image urls in input order', async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse({ body: { imageUrl: 'https://cdn.test/one.webp' } }))
      .mockResolvedValueOnce(jsonResponse({ body: { imageUrl: 'https://cdn.test/two.webp' } }));

    await expect(uploadImagesToBucket([buildFile({ name: 'one.webp' }), buildFile({ name: 'two.webp' })])).resolves.toEqual([
      'https://cdn.test/one.webp',
      'https://cdn.test/two.webp',
    ]);
  });

  it('uses backend error messages from legacy image upload failures', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ ok: false, body: { message: 'File too large' } }));

    await expect(uploadImageToBucket(buildFile())).rejects.toThrow('File too large');
  });

  it('routes home banner image uploads through the proxy route', async () => {
    const file = buildFile();
    fetch.mockResolvedValueOnce(
      jsonResponse({
        body: {
          publicUrl: 'https://cdn.test/home-banners/images/candle.webp',
          objectName: 'home-banners/images/candle.webp',
          deleteToken: 'delete-token',
        },
      })
    );

    await expect(uploadSignedFile({ kind: 'home-banner-image', file })).resolves.toEqual({
      publicUrl: 'https://cdn.test/home-banners/images/candle.webp',
      objectName: 'home-banners/images/candle.webp',
      deleteToken: 'delete-token',
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('/api/uploads/proxy', expect.objectContaining({ method: 'POST' }));
  });

  it('routes home banner mobile image uploads through the proxy route', async () => {
    const file = buildFile();
    fetch.mockResolvedValueOnce(
      jsonResponse({
        body: {
          publicUrl: 'https://cdn.test/home-banners/mobile-images/candle.webp',
          objectName: 'home-banners/mobile-images/candle.webp',
          deleteToken: 'delete-token',
        },
      })
    );

    await expect(uploadSignedFile({ kind: 'home-banner-mobile-image', file })).resolves.toEqual({
      publicUrl: 'https://cdn.test/home-banners/mobile-images/candle.webp',
      objectName: 'home-banners/mobile-images/candle.webp',
      deleteToken: 'delete-token',
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('/api/uploads/proxy', expect.objectContaining({ method: 'POST' }));
  });

  it('routes video and poster uploads through the proxy route', async () => {
    fetch.mockResolvedValueOnce(
      jsonResponse({
        body: {
          publicUrl: 'https://cdn.test/videos/demo.mp4',
          objectName: 'videos/demo.mp4',
          deleteToken: 'video-token',
        },
      })
    );

    await expect(
      uploadSignedFile({ kind: 'video', file: buildFile({ name: 'demo.mp4', type: 'video/mp4' }) })
    ).resolves.toEqual({
      publicUrl: 'https://cdn.test/videos/demo.mp4',
      objectName: 'videos/demo.mp4',
      deleteToken: 'video-token',
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('/api/uploads/proxy', expect.objectContaining({ method: 'POST' }));
  });

  it('rejects unsupported upload kinds before calling the network', async () => {
    await expect(uploadSignedFile({ kind: 'product-image', file: buildFile() })).rejects.toThrow(
      'Неподдържан тип upload.'
    );

    expect(fetch).not.toHaveBeenCalled();
  });

  it('uploads a blog article image through the blog image route', async () => {
    const file = buildFile();
    fetch.mockResolvedValueOnce(
      jsonResponse({
        body: {
          kind: 'hero',
          imageUrl: 'https://cdn.test/blog/articles/hero/article.webp',
          objectName: 'blog/articles/hero/article.webp',
          deleteToken: 'hero-token',
        },
      })
    );

    await expect(uploadBlogArticleImage({ kind: 'hero', file })).resolves.toEqual({
      kind: 'hero',
      imageUrl: 'https://cdn.test/blog/articles/hero/article.webp',
      objectName: 'blog/articles/hero/article.webp',
      deleteToken: 'hero-token',
    });

    expect(fetch).toHaveBeenCalledWith('/api/blog/images', expect.objectContaining({ method: 'POST' }));
  });

  it('rejects unsupported blog image kinds before calling the network', async () => {
    await expect(uploadBlogArticleImage({ kind: 'banner', file: buildFile() })).rejects.toThrow(
      'Unsupported blog image upload type.'
    );

    expect(fetch).not.toHaveBeenCalled();
  });

  it('uses backend error messages from blog image upload failures', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ ok: false, body: { message: 'File too large' } }));

    await expect(uploadBlogArticleImage({ kind: 'hero', file: buildFile() })).rejects.toThrow('File too large');
  });

  it('throws an explicit error when blog image upload response is incomplete', async () => {
    fetch.mockResolvedValueOnce(
      jsonResponse({
        body: {
          imageUrl: 'https://cdn.test/blog/articles/hero/article.webp',
        },
      })
    );

    await expect(uploadBlogArticleImage({ kind: 'hero', file: buildFile() })).rejects.toThrow(
      'Unexpected response from blog image upload route.'
    );
  });

  it('does not call delete route when objectName is empty', async () => {
    await expect(deleteSignedUploadedFile('', 'token')).resolves.toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('throws when delete route rejects cleanup', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ ok: false, body: { message: 'ignored' } }));

    await expect(deleteSignedUploadedFile('images/candle.webp', 'token')).rejects.toThrow(
      'Не успяхме да изчистим незаписания upload от storage.'
    );
  });
});
