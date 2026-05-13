import baseURL from '@/config';
import { createResponseError, readResponseJsonSafely } from '@/utils/errorHandler';

async function invalidateHomeBannerCaches() {
  try {
    await fetch('/api/revalidate/home-banners', {
      method: 'POST',
      credentials: 'include',
    });
  } catch (error) {
    console.error('Неуспешно обновяване на home banners cache-а:', error);
  }
}

export async function getHomeBanners() {
  try {
    const res = await fetch(`${baseURL}/home-banners`, {
      next: {
        revalidate: 60,
        tags: ['home-banners'],
      },
    });

    if (!res.ok) {
      throw new Error('Неуспешно зареждане на homepage банерите.');
    }

    const data = await readResponseJsonSafely(res);

    if (!Array.isArray(data)) {
      throw new Error('Неочакван отговор при зареждане на homepage банерите.');
    }

    return data;
  } catch (error) {
    console.error(error.message);
    return [];
  }
}

export async function getHomeBannerById(bannerId) {
  const res = await fetch(`${baseURL}/home-banners/${bannerId}`, {
    credentials: 'include',
    cache: 'no-store',
  });
  const data = await readResponseJsonSafely(res);

  if (!res.ok) {
    throw createResponseError(data?.message || 'Неуспешно зареждане на homepage банера.', data);
  }

  return data;
}

export async function createHomeBanner(values) {
  const res = await fetch(`${baseURL}/home-banners`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(values),
  });
  const data = await readResponseJsonSafely(res);

  if (!res.ok) {
    throw createResponseError(data?.message || 'Неуспешно създаване на homepage банера.', data);
  }

  await invalidateHomeBannerCaches();

  return data;
}

export async function editHomeBanner(bannerId, values) {
  const res = await fetch(`${baseURL}/home-banners/${bannerId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(values),
  });
  const data = await readResponseJsonSafely(res);

  if (!res.ok) {
    throw createResponseError(data?.message || 'Неуспешно редактиране на homepage банера.', data);
  }

  await invalidateHomeBannerCaches();

  return data;
}

export async function deleteHomeBanner(bannerId) {
  const res = await fetch(`${baseURL}/home-banners/${bannerId}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!res.ok) {
    const data = await readResponseJsonSafely(res);
    throw createResponseError(data?.message || 'Неуспешно изтриване на homepage банера.', data);
  }

  await invalidateHomeBannerCaches();
}
