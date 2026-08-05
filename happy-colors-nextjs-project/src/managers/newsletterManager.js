import baseURL from '@/config';
import { createResponseError, readResponseJsonSafely } from '@/utils/errorHandler';

export async function getNewsletterSubscribeToken() {
  const res = await fetch(`${baseURL}/newsletter/subscribe-token`, {
    credentials: 'include',
  });
  const responseData = await readResponseJsonSafely(res);

  if (!res.ok) {
    throw createResponseError(
      responseData?.message || 'Не успяхме да подготвим формата за абонамент.',
      responseData
    );
  }

  return responseData;
}

export async function subscribeToNewsletter(data) {
  const res = await fetch(`${baseURL}/newsletter/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  const responseData = await readResponseJsonSafely(res);

  if (!res.ok) {
    throw createResponseError(
      responseData?.message || 'Не успяхме да запишем абонамента.',
      responseData
    );
  }

  return responseData;
}

export async function confirmNewsletterSubscription(token) {
  const res = await fetch(`${baseURL}/newsletter/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });

  const responseData = await readResponseJsonSafely(res);

  if (!res.ok) {
    throw createResponseError(
      responseData?.message || 'Не успяхме да потвърдим абонамента.',
      responseData
    );
  }

  return responseData;
}

export async function exchangeNewsletterPreferencesToken(token) {
  const res = await fetch(`${baseURL}/newsletter/preferences/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });

  const responseData = await readResponseJsonSafely(res);

  if (!res.ok) {
    throw createResponseError(
      responseData?.message || 'Не успяхме да заредим настройките за бюлетина.',
      responseData
    );
  }

  return responseData;
}

export async function updateNewsletterPreferences({ sessionToken, locale }) {
  const res = await fetch(`${baseURL}/newsletter/preferences`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionToken, locale }),
  });

  const responseData = await readResponseJsonSafely(res);

  if (!res.ok) {
    throw createResponseError(
      responseData?.message || 'Не успяхме да обновим езика на бюлетина.',
      responseData
    );
  }

  return responseData;
}

export async function unsubscribeFromNewsletter(token) {
  const res = await fetch(`${baseURL}/newsletter/unsubscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });

  const responseData = await readResponseJsonSafely(res);

  if (!res.ok) {
    throw createResponseError(
      responseData?.message || 'Не успяхме да ви отпишем.',
      responseData
    );
  }

  return responseData;
}
