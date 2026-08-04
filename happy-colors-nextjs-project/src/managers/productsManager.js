// happy-colors-nextjs-project/src/managers/productsManager.js

import baseURL from '@/config';
import { createResponseError, readResponseJsonSafely } from '@/utils/errorHandler';

function buildUrl(path, params = {}) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, value);
    }
  }

  const query = searchParams.toString();
  return `${baseURL}${path}${query ? `?${query}` : ''}`;
}

export async function onCreateProductSubmit(
  formValues,
  setSuccess,
  setError,
  setInvalidFields,
  user,
  router,
  triggerCategoriesReload
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
    router.push(
      result.publicationStatus === 'published'
        ? `/products/${result._id}`
        : `/products/${result._id}?created=review-pending`
    );
  } catch (err) {
    setSuccess(false);
    setError(err.message || 'Възникна грешка при създаване на продукта.');

    if (err.field) {
      setInvalidFields([err.field]);
    } else {
      setInvalidFields([]);
    }
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

    if (
      result?.englishTranslationDecision &&
      typeof options.onTranslationDecision === 'function'
    ) {
      options.onTranslationDecision(result.englishTranslationDecision, result);
      return result;
    }

    router.push(
      result?.reviewStatus === 'pending_review' || result?.publicationStatus === 'pending_review'
        ? `/products/${productId}?updated=review-pending`
        : `/products/${productId}`
    );
    router.refresh();
  } catch (err) {
    setSuccess(false);
    setError(err.message || 'Възникна грешка при редакция на продукта.');

    if (err.field) {
      setInvalidFields([err.field]);
    } else {
      setInvalidFields([]);
    }
  }
}

export async function getProducts(categoryName, { locale } = {}) {
  try {
    const params = { locale };

    if (categoryName && categoryName !== 'Всички') {
      params.category = categoryName;
    }

    const res = await fetch(buildUrl('/products', params), {
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error('Неуспешно зареждане на продуктите');
    }

    const data = await readResponseJsonSafely(res);

    if (!Array.isArray(data)) {
      throw new Error('Неочакван отговор при зареждане на продуктите');
    }

    return data;
  } catch (err) {
    console.error(err.message);
    return [];
  }
}

export async function getHomepageFeaturedProducts({ locale } = {}) {
  try {
    const res = await fetch(buildUrl('/products/homepage-featured', { locale }), {
      next: {
        revalidate: 60,
        tags: ['products', 'homepage-featured-products'],
      },
    });

    if (!res.ok) {
      throw new Error('Неуспешно зареждане на продуктите за началната страница');
    }

    const data = await readResponseJsonSafely(res);

    if (!Array.isArray(data)) {
      throw new Error('Неочакван отговор при зареждане на продуктите за началната страница');
    }

    return data;
  } catch (err) {
    console.error(err.message);
    return [];
  }
}

export async function getCartoonGalleryProducts({ locale } = {}) {
  try {
    const res = await fetch(buildUrl('/products/cartoon-gallery', { locale }), {
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error('Failed to load cartoon gallery products.');
    }

    const data = await readResponseJsonSafely(res);

    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error(err.message);
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
