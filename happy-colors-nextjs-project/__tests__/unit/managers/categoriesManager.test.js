import { beforeEach, describe, expect, it, vi } from 'vitest';
import { onCreateCategorySubmit } from '../../../src/managers/categoriesManager.js';

function jsonResponse({ ok = true, body = {} } = {}) {
  return {
    ok,
    json: vi.fn().mockResolvedValue(body),
  };
}

describe('categoriesManager', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
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
});
