import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteProductImage,
  deleteProductVideo,
  getCartoonGalleryProducts,
  getHomepageFeaturedProducts,
  getProducts,
  onCreateProductSubmit,
  onEditProductSubmit,
  updateHomepageFeaturedProducts,
} from '../../../src/managers/productsManager.js';

function jsonResponse({ ok = true, body = {} } = {}) {
  return {
    ok,
    json: vi.fn().mockResolvedValue(body),
  };
}

function buildFormValues(overrides = {}) {
  return {
    title: 'Soy Candle',
    price: 18,
    category: { _id: 'cat-1', name: 'Candles' },
    imageUrls: ['https://cdn.test/one.webp', '', 'https://cdn.test/two.webp'],
    imageUrl: 'https://cdn.test/legacy.webp',
    videos: [{ videoUrl: 'https://cdn.test/video.mp4' }],
    ...overrides,
  };
}

describe('productsManager', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('loads products and encodes focused category filters', async () => {
    const products = [{ _id: 'p1', title: 'Candle' }];
    fetch.mockResolvedValueOnce(jsonResponse({ body: products }));

    await expect(getProducts('Свещи и подаръци')).resolves.toEqual(products);

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/products?category=%D0%A1%D0%B2%D0%B5%D1%89%D0%B8+%D0%B8+%D0%BF%D0%BE%D0%B4%D0%B0%D1%80%D1%8A%D1%86%D0%B8',
      expect.objectContaining({
        cache: 'no-store',
      })
    );
  });

  it('threads locale params through public product reads', async () => {
    const products = [{ _id: 'p1', title: 'English Candle' }];
    fetch
      .mockResolvedValueOnce(jsonResponse({ body: products }))
      .mockResolvedValueOnce(jsonResponse({ body: products }))
      .mockResolvedValueOnce(jsonResponse({ body: products }));

    await expect(getProducts('English Toys', { locale: 'en' })).resolves.toEqual(products);
    await expect(getHomepageFeaturedProducts({ locale: 'en' })).resolves.toEqual(products);
    await expect(getCartoonGalleryProducts({ locale: 'en' })).resolves.toEqual(products);

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3000/api/products?locale=en&category=English+Toys',
      expect.objectContaining({ cache: 'no-store' })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3000/api/products/homepage-featured?locale=en',
      expect.objectContaining({
        next: expect.objectContaining({
          tags: ['products', 'homepage-featured-products'],
        }),
      })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      'http://localhost:3000/api/products/cartoon-gallery?locale=en',
      expect.objectContaining({ cache: 'no-store' })
    );
  });

  it('returns an empty list instead of leaking product load failures', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ ok: false, body: { message: 'boom' } }));

    await expect(getProducts()).resolves.toEqual([]);
  });

  it('loads homepage featured products with the homepage cache tag', async () => {
    const products = [{ _id: 'product-1', title: 'Featured' }];
    fetch.mockResolvedValueOnce(jsonResponse({ body: products }));

    await expect(getHomepageFeaturedProducts()).resolves.toEqual(products);

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/products/homepage-featured',
      expect.objectContaining({
        next: {
          revalidate: 60,
          tags: ['products', 'homepage-featured-products'],
        },
      })
    );
  });

  it('loads homepage featured and cartoon gallery products without locale params', async () => {
    const products = [{ _id: 'product-1', title: 'Featured' }];
    fetch
      .mockResolvedValueOnce(jsonResponse({ body: products }))
      .mockResolvedValueOnce(jsonResponse({ body: products }));

    await expect(getHomepageFeaturedProducts()).resolves.toEqual(products);
    await expect(getCartoonGalleryProducts()).resolves.toEqual(products);

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3000/api/products/homepage-featured',
      expect.objectContaining({
        next: expect.objectContaining({
          tags: ['products', 'homepage-featured-products'],
        }),
      })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3000/api/products/cartoon-gallery',
      expect.objectContaining({
        cache: 'no-store',
      })
    );
  });

  it('loads cartoon gallery products fresh from the dedicated endpoint', async () => {
    const products = [
      { _id: 'product-1', title: 'First' },
      { _id: 'product-2', title: 'Second' },
    ];
    fetch.mockResolvedValueOnce(jsonResponse({ body: products }));

    await expect(getCartoonGalleryProducts()).resolves.toEqual(products);

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/products/cartoon-gallery',
      expect.objectContaining({
        cache: 'no-store',
      })
    );
  });

  it('returns an empty cartoon gallery when the response is not an array', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ body: { message: 'unexpected' } }));

    await expect(getCartoonGalleryProducts()).resolves.toEqual([]);
  });

  it('returns an empty cartoon gallery instead of leaking product load failures', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ ok: false, body: { message: 'boom' } }));

    await expect(getCartoonGalleryProducts()).resolves.toEqual([]);
  });

  it('returns an empty list instead of leaking homepage featured product load failures', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ ok: false, body: { message: 'boom' } }));

    await expect(getHomepageFeaturedProducts()).resolves.toEqual([]);
  });

  it('updates homepage featured products through the backend mutation', async () => {
    const products = [{ _id: 'product-2', title: 'Second' }];
    fetch.mockResolvedValueOnce(jsonResponse({ body: products }));

    await expect(updateHomepageFeaturedProducts(['product-2', 'product-1'])).resolves.toEqual(products);

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3000/api/products/homepage-featured',
      expect.objectContaining({
        method: 'PUT',
        credentials: 'include',
        body: JSON.stringify({ productIds: ['product-2', 'product-1'] }),
      })
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('creates products with normalized owner, category, media, and availability', async () => {
    const setSuccess = vi.fn();
    const setError = vi.fn();
    const setInvalidFields = vi.fn();
    const triggerCategoriesReload = vi.fn();
    const router = { push: vi.fn() };

    fetch.mockResolvedValueOnce(jsonResponse({ body: { _id: 'product-1', publicationStatus: 'published' } }));

    await onCreateProductSubmit(
      buildFormValues({ availability: '' }),
      setSuccess,
      setError,
      setInvalidFields,
      { _id: 'owner-1' },
      router,
      triggerCategoriesReload
    );

    const createCall = fetch.mock.calls[0];
    const payload = JSON.parse(createCall[1].body);

    expect(createCall[0]).toBe('http://localhost:3000/api/products');
    expect(createCall[1]).toMatchObject({
      method: 'POST',
      credentials: 'include',
    });
    expect(payload).toMatchObject({
      owner: 'owner-1',
      category: 'cat-1',
      imageUrls: ['https://cdn.test/one.webp', 'https://cdn.test/two.webp'],
      imageUrl: 'https://cdn.test/one.webp',
      availability: 'available',
    });
    expect(triggerCategoriesReload).toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/products/product-1');
    expect(setSuccess).toHaveBeenCalledWith(true);
    expect(setError).toHaveBeenCalledWith('');
    expect(setInvalidFields).toHaveBeenCalledWith([]);
  });

  it('redirects newly submitted artist products to the detail page with a pending-review notice', async () => {
    const setSuccess = vi.fn();
    const setError = vi.fn();
    const setInvalidFields = vi.fn();
    const triggerCategoriesReload = vi.fn();
    const router = { push: vi.fn() };

    fetch.mockResolvedValueOnce(jsonResponse({ body: { _id: 'product-2', publicationStatus: 'pending_review' } }));

    await onCreateProductSubmit(
      buildFormValues(),
      setSuccess,
      setError,
      setInvalidFields,
      { _id: 'owner-1' },
      router,
      triggerCategoriesReload
    );

    expect(router.push).toHaveBeenCalledWith('/products/product-2?created=review-pending');
    expect(setSuccess).toHaveBeenCalledWith(true);
  });

  it('maps create product field errors to invalid fields without navigating', async () => {
    const setSuccess = vi.fn();
    const setError = vi.fn();
    const setInvalidFields = vi.fn();
    const router = { push: vi.fn() };

    fetch.mockResolvedValueOnce(
      jsonResponse({
        ok: false,
        body: { message: 'Title is required', field: 'title' },
      })
    );

    await onCreateProductSubmit(
      buildFormValues(),
      setSuccess,
      setError,
      setInvalidFields,
      { _id: 'owner-1' },
      router,
      vi.fn()
    );

    expect(setSuccess).toHaveBeenCalledWith(false);
    expect(setError).toHaveBeenCalledWith('Title is required');
    expect(setInvalidFields).toHaveBeenCalledWith(['title']);
    expect(router.push).not.toHaveBeenCalled();
  });

  it('edits products and refreshes the current route', async () => {
    const setSuccess = vi.fn();
    const setError = vi.fn();
    const setInvalidFields = vi.fn();
    const router = { push: vi.fn(), refresh: vi.fn() };

    fetch.mockResolvedValueOnce(jsonResponse({ body: { _id: 'product-1', publicationStatus: 'published' } }));

    await onEditProductSubmit(
      buildFormValues({ category: 'cat-2', imageUrls: null, imageUrl: 'https://cdn.test/only.webp', videos: null }),
      setSuccess,
      setError,
      setInvalidFields,
      { _id: 'owner-1' },
      router,
      'product-1'
    );

    const updateCall = fetch.mock.calls[0];
    const payload = JSON.parse(updateCall[1].body);

    expect(updateCall[0]).toBe('http://localhost:3000/api/products/product-1');
    expect(updateCall[1]).toMatchObject({
      method: 'PUT',
      credentials: 'include',
    });
    expect(payload).toMatchObject({
      category: 'cat-2',
      imageUrls: ['https://cdn.test/only.webp'],
      imageUrl: 'https://cdn.test/only.webp',
      videos: [],
    });
    expect(router.push).toHaveBeenCalledWith('/products/product-1');
    expect(router.refresh).toHaveBeenCalled();
    expect(setSuccess).toHaveBeenCalledWith(true);
  });

  it('redirects artist edits waiting for approval with a review notice', async () => {
    const setSuccess = vi.fn();
    const setError = vi.fn();
    const setInvalidFields = vi.fn();
    const router = { push: vi.fn(), refresh: vi.fn() };

    fetch.mockResolvedValueOnce(
      jsonResponse({
        body: {
          _id: 'product-1',
          publicationStatus: 'published',
          reviewStatus: 'pending_review',
        },
      })
    );

    await onEditProductSubmit(
      buildFormValues(),
      setSuccess,
      setError,
      setInvalidFields,
      { _id: 'owner-1' },
      router,
      'product-1'
    );

    expect(router.push).toHaveBeenCalledWith('/products/product-1?updated=review-pending');
    expect(router.refresh).toHaveBeenCalled();
    expect(setSuccess).toHaveBeenCalledWith(true);
  });

  it('surfaces direct edit English translation decisions without navigating first', async () => {
    const setSuccess = vi.fn();
    const setError = vi.fn();
    const setInvalidFields = vi.fn();
    const router = { push: vi.fn(), refresh: vi.fn() };
    const onTranslationDecision = vi.fn();
    const englishTranslationDecision = {
      locale: 'en',
      status: 'needs_decision',
      sourceRevision: 3,
      translationRevision: 1,
      translationSourceRevision: 2,
    };

    fetch.mockResolvedValueOnce(
      jsonResponse({
        body: {
          _id: 'product-1',
          publicationStatus: 'published',
          englishTranslationDecision,
        },
      })
    );

    await onEditProductSubmit(
      buildFormValues(),
      setSuccess,
      setError,
      setInvalidFields,
      { _id: 'admin-1', role: 'full_admin' },
      router,
      'product-1',
      { onTranslationDecision }
    );

    expect(onTranslationDecision).toHaveBeenCalledWith(
      englishTranslationDecision,
      expect.objectContaining({ _id: 'product-1' })
    );
    expect(router.push).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
    expect(setSuccess).toHaveBeenCalledWith(true);
    expect(setError).toHaveBeenCalledWith('');
    expect(setInvalidFields).toHaveBeenCalledWith([]);
  });

  it('deletes product images with credentials and returns backend result', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ body: { imageUrls: ['remaining.webp'] } }));

    await expect(deleteProductImage('product-1', 'https://cdn.test/deleted.webp')).resolves.toEqual({
      imageUrls: ['remaining.webp'],
    });

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/products/product-1/image',
      expect.objectContaining({
        method: 'DELETE',
        credentials: 'include',
        body: JSON.stringify({ imageUrl: 'https://cdn.test/deleted.webp' }),
      })
    );
  });

  it('throws backend messages when deleting product videos fails', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ ok: false, body: { message: 'Not allowed' } }));

    await expect(deleteProductVideo('product-1', 'https://cdn.test/video.mp4')).rejects.toThrow('Not allowed');
  });
});
