import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createHomeBanner,
  deleteHomeBanner,
  editHomeBanner,
  getCartoonHeroBanners,
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
  placement: 'home',
  ctaHref: '/search?q=Р¶РёРІРѕС‚РёРЅРєРё',
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

  it('loads cartoon hero banners with the cartoon cache tag', async () => {
    const cartoonBanner = { ...banner, placement: 'cartoons' };
    fetch.mockResolvedValueOnce(jsonResponse({ body: [cartoonBanner] }));

    await expect(getCartoonHeroBanners()).resolves.toEqual([cartoonBanner]);

    expect(fetch).toHaveBeenCalledWith(
      '/api/home-banners?placement=cartoons',
      expect.objectContaining({
        next: {
          revalidate: 60,
          tags: ['cartoon-hero-banners'],
        },
      })
    );
  });

  it('returns an empty list when banner loading fails', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ ok: false, body: { message: 'boom' } }));

    await expect(getHomeBanners()).resolves.toEqual([]);
  });

  it('returns an empty list when cartoon banner loading fails', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ ok: false, body: { message: 'boom' } }));

    await expect(getCartoonHeroBanners()).resolves.toEqual([]);
  });

  it('returns an empty list when cartoon banner loading returns a non-array payload', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ body: { banners: [] } }));

    await expect(getCartoonHeroBanners()).resolves.toEqual([]);
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

  it('creates a cartoon banner and invalidates cartoon banner cache', async () => {
    const cartoonBanner = { ...banner, placement: 'cartoons' };
    fetch.mockResolvedValueOnce(jsonResponse({ body: cartoonBanner })).mockResolvedValueOnce(jsonResponse());

    await expect(
      createHomeBanner({ placement: 'cartoons', imageUrl: 'https://cdn.test/cartoon.webp' })
    ).resolves.toEqual(cartoonBanner);

    expect(fetch).toHaveBeenNthCalledWith(2, '/api/revalidate/cartoon-hero-banners', expect.any(Object));
  });

  it('edits and deletes banners with credentials and cache invalidation', async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse({ body: banner }))
      .mockResolvedValueOnce(jsonResponse())
      .mockResolvedValueOnce(jsonResponse({ body: {} }))
      .mockResolvedValueOnce(jsonResponse());

    await expect(editHomeBanner('banner-1', { title: 'Updated' })).resolves.toEqual(banner);
    await expect(deleteHomeBanner('banner-1', { placement: 'home' })).resolves.toBeUndefined();

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

  it('revalidates both banner surfaces when placement changes', async () => {
    const cartoonBanner = { ...banner, placement: 'cartoons' };
    fetch
      .mockResolvedValueOnce(jsonResponse({ body: cartoonBanner }))
      .mockResolvedValueOnce(jsonResponse())
      .mockResolvedValueOnce(jsonResponse());

    await expect(
      editHomeBanner('banner-1', { placement: 'cartoons' }, { previousPlacement: 'home' })
    ).resolves.toEqual(cartoonBanner);

    expect(fetch).toHaveBeenNthCalledWith(2, '/api/revalidate/home-banners', expect.any(Object));
    expect(fetch).toHaveBeenNthCalledWith(3, '/api/revalidate/cartoon-hero-banners', expect.any(Object));
  });

  it('revalidates both banner surfaces when edit placement is unknown', async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse({ body: {} }))
      .mockResolvedValueOnce(jsonResponse())
      .mockResolvedValueOnce(jsonResponse());

    await expect(editHomeBanner('banner-1', {})).resolves.toEqual({});

    expect(fetch).toHaveBeenNthCalledWith(2, '/api/revalidate/home-banners', expect.any(Object));
    expect(fetch).toHaveBeenNthCalledWith(3, '/api/revalidate/cartoon-hero-banners', expect.any(Object));
  });

  it('invalidates homepage banner cache for mobile-only image edits', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ body: banner })).mockResolvedValueOnce(jsonResponse());

    await expect(
      editHomeBanner('banner-1', {
        mobileImageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/mobile-images/banner.webp',
      })
    ).resolves.toEqual(banner);

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      '/api/home-banners/banner-1',
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

  it('throws backend messages from mutation failures', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ ok: false, body: { message: 'Not allowed' } }));

    await expect(createHomeBanner({ title: 'Nope' })).rejects.toThrow('Not allowed');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
