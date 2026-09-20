import baseURL from '@/config';
import { createResponseError, readResponseJsonSafely } from '@/utils/errorHandler';
import { buildApiUrl, getPublicServerFetchOptions } from './requestUtils';

async function fetchVisibleCategoriesResult({ locale } = {}) {
  try {
    const res = await fetch(
      buildApiUrl(baseURL, '/categories/visible', { locale }),
      getPublicServerFetchOptions({
        tags: ['categories', 'visible-categories', 'products'],
        browserNoStore: false,
      })
    );

    if (!res.ok) {
      throw new Error('Failed to load visible categories.');
    }

    const data = await readResponseJsonSafely(res);

    return {
      categories: Array.isArray(data) ? data : [],
      loaded: true,
    };
  } catch (err) {
    console.warn(err.message);
    return {
      categories: [],
      loaded: false,
    };
  }
}

async function fetchVisibleCategoryRedirectsResult({ locale } = {}) {
  try {
    const res = await fetch(
      buildApiUrl(baseURL, '/categories/visible/redirects', { locale }),
      getPublicServerFetchOptions({
        tags: ['categories', 'visible-categories', 'products'],
        browserNoStore: false,
      })
    );

    if (!res.ok) {
      throw new Error('Failed to load category redirect candidates.');
    }

    const data = await readResponseJsonSafely(res);

    return {
      categories: Array.isArray(data) ? data : [],
      loaded: true,
    };
  } catch (err) {
    console.warn(err.message);
    return {
      categories: [],
      loaded: false,
    };
  }
}

export async function getVisibleCategories(options = {}) {
  const result = await fetchVisibleCategoriesResult(options);

  return result.categories;
}

export async function getVisibleCategoriesSeed(options = {}) {
  return fetchVisibleCategoriesResult(options);
}

export async function getVisibleCategoryRedirectCandidates(options = {}) {
  const result = await fetchVisibleCategoryRedirectsResult(options);

  return result.categories;
}

export async function getVisibleCategoryRedirectCandidatesSeed(options = {}) {
  return fetchVisibleCategoryRedirectsResult(options);
}

export async function onCreateCategorySubmit(
  formValues,
  setSuccess,
  setError,
  setInvalidFields,
  router,
  triggerCategoriesReload
) {
  try {
    const res = await fetch(`${baseURL}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(formValues),
    });

    const result = await readResponseJsonSafely(res);

    if (!res.ok) {
      throw createResponseError(
        result?.message || 'Възникна грешка при създаване на категория.',
        result
      );
    }

    setSuccess(true);
    triggerCategoriesReload(); 
    setError('');
    setInvalidFields([]);

    // 🟢 Редирект към формата за създаване на продукт
    router.push('/products/create');
  } catch (err) {
    setSuccess(false);
    setError(err.message || 'Възникна грешка при създаване на категория.');
    if (err.field) {
      setInvalidFields([err.field]);
    } else {
      setInvalidFields([]);
    }
  }
}
