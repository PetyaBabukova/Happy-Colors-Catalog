// happy-colors-nextjs-project/src/managers/productsManager.js

import baseURL from '@/config';
import { createResponseError, readResponseJsonSafely } from '@/utils/errorHandler';

async function invalidateProductCaches(productId) {
  try {
    await fetch('/api/revalidate/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ productId }),
    });
  } catch (error) {
    console.error('Неуспешно обновяване на product cache-а:', error);
  }
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
    await invalidateProductCaches(result._id);

    router.push(`/products/${result._id}`);
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
  productId
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
    await invalidateProductCaches(productId);
    router.push(`/products/${productId}`);
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

export async function getProducts(categoryName) {
  try {
    let url = `${baseURL}/products`;

    if (categoryName && categoryName !== 'Всички') {
      url += `?category=${encodeURIComponent(categoryName)}`;
    }

    const res = await fetch(url, {
      next: {
        revalidate: 60,
        tags: ['products'],
      },
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
