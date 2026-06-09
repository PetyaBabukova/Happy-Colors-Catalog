// happy-colors-nextjs-project/src/managers/productsManager.js

import baseURL from '@/config';
import { CARTOON_GALLERY_PRODUCT_IDS } from '@/config/cartoonGalleryProducts';
import { createResponseError, readResponseJsonSafely } from '@/utils/errorHandler';

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

export async function getProducts(categoryName) {
  try {
    let url = `${baseURL}/products`;

    if (categoryName && categoryName !== 'Всички') {
      url += `?category=${encodeURIComponent(categoryName)}`;
    }

    const res = await fetch(url, {
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

export async function getHomepageFeaturedProducts() {
  try {
    const res = await fetch(`${baseURL}/products/homepage-featured`, {
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

async function getCartoonGalleryProductPool() {
  const res = await fetch(`${baseURL}/products`, {
    next: {
      revalidate: 60,
      tags: ['products', 'cartoon-gallery-products'],
    },
  });

  if (!res.ok) {
    throw new Error('Failed to load cartoon gallery products.');
  }

  const data = await readResponseJsonSafely(res);

  if (!Array.isArray(data)) {
    throw new Error('Unexpected cartoon gallery products response.');
  }

  return data;
}

export async function getCartoonGalleryProducts() {
  const configuredIds = [
    ...new Set(
      CARTOON_GALLERY_PRODUCT_IDS.map((productId) => String(productId || '').trim()).filter(Boolean)
    ),
  ];

  if (configuredIds.length === 0) {
    return [];
  }

  try {
    const products = await getCartoonGalleryProductPool();
    const productsById = new Map(
      products
        .filter((product) => product?.availability !== 'unavailable')
        .map((product) => [String(product._id), product])
    );

    return configuredIds.map((productId) => productsById.get(productId)).filter(Boolean);
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
