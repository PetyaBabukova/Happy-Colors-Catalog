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
