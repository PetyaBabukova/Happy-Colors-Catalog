import baseURL from '@/config';
import { createResponseError, readResponseJsonSafely } from '@/utils/errorHandler';
import { buildApiUrl, getPublicServerFetchOptions } from './requestUtils';

const BANNER_PLACEMENTS = new Set(['home', 'cartoons']);

function normalizeBannerPlacement(value) {
  const placement = String(value || 'home').trim().toLowerCase();

  return BANNER_PLACEMENTS.has(placement) ? placement : 'home';
}

async function postRevalidation(path, errorMessage) {
  try {
    await fetch(path, {
      method: 'POST',
      credentials: 'include',
    });
  } catch (error) {
    console.error(errorMessage, error);
  }
}

async function invalidateBannerCachesForPlacements(placements = ['home']) {
  const normalizedPlacements = new Set(placements.map(normalizeBannerPlacement));
  const tasks = [];

  if (normalizedPlacements.has('home')) {
    tasks.push(
      postRevalidation(
        '/api/revalidate/home-banners',
        'РќРµСѓСЃРїРµС€РЅРѕ РѕР±РЅРѕРІСЏРІР°РЅРµ РЅР° home banners cache-Р°:'
      )
    );
  }

  if (normalizedPlacements.has('cartoons')) {
    tasks.push(
      postRevalidation(
        '/api/revalidate/cartoon-hero-banners',
        'РќРµСѓСЃРїРµС€РЅРѕ РѕР±РЅРѕРІСЏРІР°РЅРµ РЅР° cartoon hero banners cache-Р°:'
      )
    );
  }

  await Promise.all(tasks);
}

export async function getHomeBanners({ locale } = {}) {
  try {
    const res = await fetch(
      buildApiUrl(baseURL, '/home-banners', { locale }),
      getPublicServerFetchOptions({ tags: ['home-banners'], browserNoStore: false })
    );

    if (!res.ok) {
      throw new Error('РќРµСѓСЃРїРµС€РЅРѕ Р·Р°СЂРµР¶РґР°РЅРµ РЅР° homepage Р±Р°РЅРµСЂРёС‚Рµ.');
    }

    const data = await readResponseJsonSafely(res);

    if (!Array.isArray(data)) {
      throw new Error('РќРµРѕС‡Р°РєРІР°РЅ РѕС‚РіРѕРІРѕСЂ РїСЂРё Р·Р°СЂРµР¶РґР°РЅРµ РЅР° homepage Р±Р°РЅРµСЂРёС‚Рµ.');
    }

    return data;
  } catch (error) {
    console.error(error.message);
    return [];
  }
}

export async function getCartoonHeroBanners({ locale } = {}) {
  try {
    const res = await fetch(
      buildApiUrl(baseURL, '/home-banners', { placement: 'cartoons', locale }),
      getPublicServerFetchOptions({ tags: ['cartoon-hero-banners'], browserNoStore: false })
    );

    if (!res.ok) {
      throw new Error('РќРµСѓСЃРїРµС€РЅРѕ Р·Р°СЂРµР¶РґР°РЅРµ РЅР° С€Р°СЂР¶ Р±Р°РЅРµСЂРёС‚Рµ.');
    }

    const data = await readResponseJsonSafely(res);

    if (!Array.isArray(data)) {
      throw new Error('РќРµРѕС‡Р°РєРІР°РЅ РѕС‚РіРѕРІРѕСЂ РїСЂРё Р·Р°СЂРµР¶РґР°РЅРµ РЅР° С€Р°СЂР¶ Р±Р°РЅРµСЂРёС‚Рµ.');
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
    throw createResponseError(data?.message || 'РќРµСѓСЃРїРµС€РЅРѕ Р·Р°СЂРµР¶РґР°РЅРµ РЅР° homepage Р±Р°РЅРµСЂР°.', data);
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
    throw createResponseError(data?.message || 'РќРµСѓСЃРїРµС€РЅРѕ СЃСЉР·РґР°РІР°РЅРµ РЅР° homepage Р±Р°РЅРµСЂР°.', data);
  }

  await invalidateBannerCachesForPlacements([data?.placement || values?.placement || 'home']);

  return data;
}

export async function editHomeBanner(bannerId, values, { previousPlacement } = {}) {
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
    throw createResponseError(data?.message || 'РќРµСѓСЃРїРµС€РЅРѕ СЂРµРґР°РєС‚РёСЂР°РЅРµ РЅР° homepage Р±Р°РЅРµСЂР°.', data);
  }

  const placementsToInvalidate = new Set(
    [previousPlacement, values?.placement, data?.placement].filter(Boolean)
  );

  if (placementsToInvalidate.size === 0) {
    placementsToInvalidate.add('home');
    placementsToInvalidate.add('cartoons');
  }

  await invalidateBannerCachesForPlacements([...placementsToInvalidate]);

  return data;
}

export async function deleteHomeBanner(bannerId, { placement } = {}) {
  const res = await fetch(`${baseURL}/home-banners/${bannerId}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!res.ok) {
    const data = await readResponseJsonSafely(res);
    throw createResponseError(data?.message || 'РќРµСѓСЃРїРµС€РЅРѕ РёР·С‚СЂРёРІР°РЅРµ РЅР° homepage Р±Р°РЅРµСЂР°.', data);
  }

  await invalidateBannerCachesForPlacements(placement ? [placement] : ['home', 'cartoons']);
}
