import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createHomeBanner,
  deleteHomeBanner,
  editHomeBanner,
  getHomeBannerById,
  getHomeBanners,
} from '../../../src/managers/homeBannersManager.js';

function jsonResponse({ ok = true, body = {} } = {}) {
  return {
    ok,
    json: vi.fn().mockResolvedValue(body),
  };
}

const banner = {
  _id: 'banner-1',
  title: 'Animals',
  ctaHref: '/search?q=животинки',
};

describe('homeBannersManager', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('loads home banners with the homepage cache tag', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ body: [banner] }));

    await expect(getHomeBanners()).resolves.toEqual([banner]);

    expect(fetch).toHaveBeenCalledWith(
      '/api/home-banners',
      expect.objectContaining({
        next: {
          revalidate: 60,
          tags: ['home-banners'],
        },
      })
    );
  });

  it('returns an empty list when banner loading fails', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ ok: false, body: { message: 'boom' } }));

    await expect(getHomeBanners()).resolves.toEqual([]);
  });

  it('loads a single banner with credentials and no store cache', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ body: banner }));

    await expect(getHomeBannerById('banner-1')).resolves.toEqual(banner);

    expect(fetch).toHaveBeenCalledWith(
      '/api/home-banners/banner-1',
      expect.objectContaining({
        credentials: 'include',
        cache: 'no-store',
      })
    );
  });

  it('creates a banner and invalidates homepage banner cache', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ body: banner })).mockResolvedValueOnce(jsonResponse());

    await expect(createHomeBanner({ title: 'Animals' })).resolves.toEqual(banner);

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      '/api/home-banners',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ title: 'Animals' }),
      })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      '/api/revalidate/home-banners',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      })
    );
  });

  it('edits and deletes banners with credentials and cache invalidation', async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse({ body: banner }))
      .mockResolvedValueOnce(jsonResponse())
      .mockResolvedValueOnce(jsonResponse({ body: {} }))
      .mockResolvedValueOnce(jsonResponse());

    await expect(editHomeBanner('banner-1', { title: 'Updated' })).resolves.toEqual(banner);
    await expect(deleteHomeBanner('banner-1')).resolves.toBeUndefined();

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      '/api/home-banners/banner-1',
      expect.objectContaining({
        method: 'PUT',
        credentials: 'include',
      })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      '/api/home-banners/banner-1',
      expect.objectContaining({
        method: 'DELETE',
        credentials: 'include',
      })
    );
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/revalidate/home-banners', expect.any(Object));
    expect(fetch).toHaveBeenNthCalledWith(4, '/api/revalidate/home-banners', expect.any(Object));
  });

  it('throws backend messages from mutation failures', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ ok: false, body: { message: 'Not allowed' } }));

    await expect(createHomeBanner({ title: 'Nope' })).rejects.toThrow('Not allowed');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
