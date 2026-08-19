// happy-colors-nextjs-project/src/managers/productsManager.js

import baseURL from '@/config';
import { createResponseError, readResponseJsonSafely } from '@/utils/errorHandler';
import { buildApiUrl, getPublicServerFetchOptions } from './requestUtils';

export async function revalidatePublicProductSurfaces(productId) {
  if (typeof window === 'undefined') {
    return { skipped: true };
  }

  try {
    const payload = productId ? { productId: String(productId) } : {};
    const res = await fetch('/api/revalidate/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      return { ok: false, status: res.status };
    }

    return { ok: true };
  } catch (error) {
    console.error('Failed to revalidate public product surfaces:', error);
    return { ok: false, error: true };
  }
}

function publicHref(path, options = {}) {
  return typeof options.publicHref === 'function' ? options.publicHref(path) : path;
}

export function canRequestPublicProductRevalidation(user) {
  return (
    user?.role === 'full_admin' ||
    (user?.role === 'artist' && user?.artistStatus !== 'suspended')
  );
}

export async function onCreateProductSubmit(
  formValues,
  setSuccess,
  setError,
  setInvalidFields,
  user,
  router,
  triggerCategoriesReload,
  options = {}
) {
  try {
    const normalizedImageUrls = Array.isArray(formValues.imageUrls)
      ? formValues.imageUrls.filter(Boolean)
      : formValues.imageUrl
        ? [formValues.imageUrl]
        : [];

    const payload = {
      ...formValues,
      owner: user._id,
      category: formValues.category?._id || formValues.category || '',
      imageUrls: normalizedImageUrls,
      imageUrl: normalizedImageUrls[0] || '',
      videos: Array.isArray(formValues.videos) ? formValues.videos : [],
      availability: formValues.availability || 'available',
    };

    const res = await fetch(`${baseURL}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    const result = await readResponseJsonSafely(res);

    if (!res.ok) {
      throw createResponseError(
        result?.message || 'Възникна грешка при създаване на продукта.',
        result
      );
    }

    if (!result?._id) {
      throw new Error('Неочакван отговор от сървъра.');
    }

    setSuccess(true);
    setError('');
    setInvalidFields([]);

    triggerCategoriesReload();
    if (result.publicationStatus === 'published' && canRequestPublicProductRevalidation(user)) {
      await revalidatePublicProductSurfaces(result._id);
    }
    router.push(
      result.publicationStatus === 'published'
        ? publicHref(`/products/${result._id}`, options)
        : publicHref(`/products/${result._id}?created=review-pending`, options)
    );
    router.refresh?.();
    return result;
  } catch (err) {
    setSuccess(false);
    setError(err.message || 'Възникна грешка при създаване на продукта.');

    if (err.field) {
      setInvalidFields([err.field]);
    } else {
      setInvalidFields([]);
    }

    return null;
  }
}

export async function onEditProductSubmit(
  formValues,
  setSuccess,
  setError,
  setInvalidFields,
  user,
  router,
  productId,
  options = {}
) {
  try {
    const normalizedImageUrls = Array.isArray(formValues.imageUrls)
      ? formValues.imageUrls.filter(Boolean)
      : formValues.imageUrl
        ? [formValues.imageUrl]
        : [];

    const payload = {
      ...formValues,
      category: formValues.category?._id || formValues.category || '',
      imageUrls: normalizedImageUrls,
      imageUrl: normalizedImageUrls[0] || '',
      videos: Array.isArray(formValues.videos) ? formValues.videos : [],
      availability: formValues.availability || 'available',
    };

    const res = await fetch(`${baseURL}/products/${productId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    const result = await readResponseJsonSafely(res);

    if (!res.ok) {
      throw createResponseError(
        result?.message || 'Възникна грешка при редакция на продукта.',
        result
      );
    }

    setSuccess(true);
    setError('');
    setInvalidFields([]);

    if (canRequestPublicProductRevalidation(user)) {
      await revalidatePublicProductSurfaces(productId);
    }

    if (
      result?.englishTranslationDecision &&
      typeof options.onTranslationDecision === 'function'
    ) {
      options.onTranslationDecision(result.englishTranslationDecision, result);
      return result;
    }

    router.push(
      result?.reviewStatus === 'pending_review' || result?.publicationStatus === 'pending_review'
        ? publicHref(`/products/${productId}?updated=review-pending`, options)
        : publicHref(`/products/${productId}`, options)
    );
    router.refresh();
    return result;
  } catch (err) {
    setSuccess(false);
    setError(err.message || 'Възникна грешка при редакция на продукта.');

    if (err.field) {
      setInvalidFields([err.field]);
    } else {
      setInvalidFields([]);
    }

    return null;
  }
}

export async function getProducts(categoryName, { locale } = {}) {
  try {
    const params = { locale };

    if (categoryName && categoryName !== 'Всички') {
      params.category = categoryName;
    }

    const res = await fetch(
      buildApiUrl(baseURL, '/products', params),
      getPublicServerFetchOptions({ tags: ['products'] })
    );

    if (!res.ok) {
      throw new Error('Неуспешно зареждане на продуктите');
    }

    const data = await readResponseJsonSafely(res);

    if (!Array.isArray(data)) {
      throw new Error('Неочакван отговор при зареждане на продуктите');
    }

    return data;
  } catch (err) {
    console.warn(err.message);
    return [];
  }
}

export async function getHomepageFeaturedProducts({ locale } = {}) {
  try {
    const res = await fetch(
      buildApiUrl(baseURL, '/products/homepage-featured', { locale }),
      getPublicServerFetchOptions({ tags: ['products', 'homepage-featured-products'] })
    );

    if (!res.ok) {
      throw new Error('Неуспешно зареждане на продуктите за началната страница');
    }

    const data = await readResponseJsonSafely(res);

    if (!Array.isArray(data)) {
      throw new Error('Неочакван отговор при зареждане на продуктите за началната страница');
    }

    return data;
  } catch (err) {
    console.warn(err.message);
    return [];
  }
}

export async function getCartoonGalleryProducts({ locale } = {}) {
  try {
    const res = await fetch(
      buildApiUrl(baseURL, '/products/cartoon-gallery', { locale }),
      getPublicServerFetchOptions({ tags: ['products', 'cartoon-gallery-products'], browserNoStore: false })
    );

    if (!res.ok) {
      throw new Error('Failed to load cartoon gallery products.');
    }

    const data = await readResponseJsonSafely(res);

    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn(err.message);
    return [];
  }
}

export async function updateHomepageFeaturedProducts(productIds) {
  const res = await fetch(`${baseURL}/products/homepage-featured`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ productIds }),
  });

  const result = await readResponseJsonSafely(res);

  if (!res.ok) {
    throw createResponseError(
      result?.message || 'Възникна грешка при обновяване на любимите продукти.',
      result
    );
  }

  return Array.isArray(result) ? result : [];
}

export async function deleteProductImage(productId, imageUrl) {
  const res = await fetch(`${baseURL}/products/${productId}/image`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ imageUrl }),
  });

  const result = await readResponseJsonSafely(res);

  if (!res.ok) {
    throw new Error(result?.message || 'Грешка при изтриване на изображение');
  }

  return result;
}

export async function deleteProductVideo(productId, videoUrl) {
  const res = await fetch(`${baseURL}/products/${productId}/video`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ videoUrl }),
  });

  const result = await readResponseJsonSafely(res);

  if (!res.ok) {
    throw new Error(result?.message || 'Грешка при изтриване на видео');
  }

  return result;
}
