import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getVisibleCategories,
  getVisibleCategoriesSeed,
  onCreateCategorySubmit,
} from '../../../src/managers/categoriesManager.js';
import { jsonResponse } from '../../api/_helpers.js';

describe('categoriesManager', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('creates a category, reloads categories, and navigates to product creation', async () => {
    const setSuccess = vi.fn();
    const setError = vi.fn();
    const setInvalidFields = vi.fn();
    const router = { push: vi.fn() };
    const triggerCategoriesReload = vi.fn();
    const formValues = { name: 'Candles' };

    fetch.mockResolvedValueOnce(jsonResponse({ body: { _id: 'cat-1', name: 'Candles' } }));

    await onCreateCategorySubmit(
      formValues,
      setSuccess,
      setError,
      setInvalidFields,
      router,
      triggerCategoriesReload
    );

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/categories',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify(formValues),
      })
    );
    expect(setSuccess).toHaveBeenCalledWith(true);
    expect(triggerCategoriesReload).toHaveBeenCalledTimes(1);
    expect(setError).toHaveBeenCalledWith('');
    expect(setInvalidFields).toHaveBeenCalledWith([]);
    expect(router.push).toHaveBeenCalledWith('/products/create');
  });

  it('maps backend field errors to invalid fields', async () => {
    const setSuccess = vi.fn();
    const setError = vi.fn();
    const setInvalidFields = vi.fn();

    fetch.mockResolvedValueOnce(
      jsonResponse({
        ok: false,
        body: { message: 'Category already exists', field: 'name' },
      })
    );

    await onCreateCategorySubmit({ name: 'Candles' }, setSuccess, setError, setInvalidFields, { push: vi.fn() }, vi.fn());

    expect(setSuccess).toHaveBeenCalledWith(false);
    expect(setError).toHaveBeenCalledWith('Category already exists');
    expect(setInvalidFields).toHaveBeenCalledWith(['name']);
  });

  it('uses a generic error and clears invalid fields when the failure has no field', async () => {
    const setSuccess = vi.fn();
    const setError = vi.fn();
    const setInvalidFields = vi.fn();

    fetch.mockResolvedValueOnce(jsonResponse({ ok: false, body: {} }));

    await onCreateCategorySubmit({ name: 'Candles' }, setSuccess, setError, setInvalidFields, { push: vi.fn() }, vi.fn());

    expect(setSuccess).toHaveBeenCalledWith(false);
    expect(setError).toHaveBeenCalledWith(expect.any(String));
    expect(setInvalidFields).toHaveBeenCalledWith([]);
  });

  it('loads visible categories with public cache tags and locale separation', async () => {
    const categories = [{ _id: 'cat-1', name: 'Candles' }];
    fetch.mockResolvedValueOnce(jsonResponse({ body: categories }));

    await expect(getVisibleCategories({ locale: 'en' })).resolves.toEqual(categories);

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/categories/visible?locale=en',
      expect.objectContaining({
        next: {
          revalidate: 60,
          tags: ['categories', 'visible-categories', 'products'],
        },
      })
    );
  });

  it('returns an empty visible category list for failed public reads', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ ok: false, body: { message: 'boom' } }));

    await expect(getVisibleCategories()).resolves.toEqual([]);
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledOnce();
  });

  it('marks failed visible category seeds so the client can recover', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ ok: false, body: { message: 'boom' } }));

    await expect(getVisibleCategoriesSeed({ locale: 'en' })).resolves.toEqual({
      categories: [],
      loaded: false,
    });
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledOnce();
  });
});
