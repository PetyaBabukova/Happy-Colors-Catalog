import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createHomeBanner,
  deleteHomeBanner,
  editHomeBanner,
  getCartoonHeroBanners,
  getHomeBannerById,
  getHomeBanners,
} from '../../../src/managers/homeBannersManager.js';
import { jsonResponse } from '../../api/_helpers.js';

describe('homeBannersManager', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('loads home banners with public cache tags and locale separation', async () => {
    const banners = [{ _id: 'banner-1', title: 'Hero' }];
    fetch.mockResolvedValueOnce(jsonResponse({ body: banners }));

    await expect(getHomeBanners({ locale: 'en' })).resolves.toEqual(banners);

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/home-banners?locale=en',
      expect.objectContaining({
        next: {
          revalidate: 60,
          tags: ['home-banners'],
        },
      })
    );
  });

  it('loads cartoon hero banners with cartoon cache tags and locale separation', async () => {
    const banners = [{ _id: 'banner-2', placement: 'cartoons' }];
    fetch.mockResolvedValueOnce(jsonResponse({ body: banners }));

    await expect(getCartoonHeroBanners({ locale: 'en' })).resolves.toEqual(banners);

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/home-banners?placement=cartoons&locale=en',
      expect.objectContaining({
        next: {
          revalidate: 60,
          tags: ['cartoon-hero-banners'],
        },
      })
    );
  });

  it('returns empty public banner lists for failed reads', async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse({ ok: false, body: { message: 'boom' } }))
      .mockResolvedValueOnce(jsonResponse({ body: { message: 'not an array' } }));

    await expect(getHomeBanners()).resolves.toEqual([]);
    await expect(getCartoonHeroBanners()).resolves.toEqual([]);
  });

  it('loads a single banner with credentials and no-store cache', async () => {
    const banner = { _id: 'banner-1', title: 'Hero' };
    fetch.mockResolvedValueOnce(jsonResponse({ body: banner }));

    await expect(getHomeBannerById('banner-1')).resolves.toEqual(banner);

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/home-banners/banner-1',
      expect.objectContaining({
        credentials: 'include',
        cache: 'no-store',
      })
    );
  });

  it('invalidates only the created banner placement', async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse({ body: { _id: 'banner-1', placement: 'cartoons' } }))
      .mockResolvedValueOnce(jsonResponse());

    await expect(createHomeBanner({ placement: 'cartoons', title: 'Hero' })).resolves.toEqual({
      _id: 'banner-1',
      placement: 'cartoons',
    });

    expect(fetch).toHaveBeenNthCalledWith(
      2,
      '/api/revalidate/cartoon-hero-banners',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      })
    );
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('invalidates previous and current placements after editing', async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse({ body: { _id: 'banner-1', placement: 'cartoons' } }))
      .mockResolvedValueOnce(jsonResponse())
      .mockResolvedValueOnce(jsonResponse());

    await editHomeBanner('banner-1', { placement: 'cartoons', title: 'Hero' }, { previousPlacement: 'home' });

    expect(fetch.mock.calls.map((call) => call[0])).toEqual([
      'http://localhost:3000/api/home-banners/banner-1',
      '/api/revalidate/home-banners',
      '/api/revalidate/cartoon-hero-banners',
    ]);
  });

  it('invalidates both placements when edit placement is unknown', async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse({ body: { _id: 'banner-1' } }))
      .mockResolvedValueOnce(jsonResponse())
      .mockResolvedValueOnce(jsonResponse());

    await expect(editHomeBanner('banner-1', { title: 'Hero' })).resolves.toEqual({ _id: 'banner-1' });

    expect(fetch.mock.calls.map((call) => call[0])).toEqual([
      'http://localhost:3000/api/home-banners/banner-1',
      '/api/revalidate/home-banners',
      '/api/revalidate/cartoon-hero-banners',
    ]);
  });

  it('invalidates homepage banner cache for mobile-only image edits', async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse({ body: { _id: 'banner-1', placement: 'home' } }))
      .mockResolvedValueOnce(jsonResponse());

    await expect(
      editHomeBanner('banner-1', {
        mobileImageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/mobile-images/banner.webp',
      })
    ).resolves.toEqual({ _id: 'banner-1', placement: 'home' });

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3000/api/home-banners/banner-1',
      expect.objectContaining({
        method: 'PUT',
        credentials: 'include',
        body: JSON.stringify({
          mobileImageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/mobile-images/banner.webp',
        }),
      })
    );
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/revalidate/home-banners', expect.any(Object));
  });

  it('invalidates both placements when deleting without placement context', async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse())
      .mockResolvedValueOnce(jsonResponse())
      .mockResolvedValueOnce(jsonResponse());

    await expect(deleteHomeBanner('banner-1')).resolves.toBeUndefined();

    expect(fetch.mock.calls.map((call) => call[0])).toEqual([
      'http://localhost:3000/api/home-banners/banner-1',
      '/api/revalidate/home-banners',
      '/api/revalidate/cartoon-hero-banners',
    ]);
  });

  it('throws backend messages from mutation failures without invalidating caches', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ ok: false, body: { message: 'Not allowed' } }));

    await expect(createHomeBanner({ title: 'Nope' })).rejects.toThrow('Not allowed');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
