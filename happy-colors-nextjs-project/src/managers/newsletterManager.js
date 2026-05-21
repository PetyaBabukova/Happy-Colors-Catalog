import baseURL from '@/config';
import { readResponseJsonSafely } from '@/utils/errorHandler';

export async function subscribeToNewsletter(data) {
  const res = await fetch(`${baseURL}/newsletter/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  const responseData = await readResponseJsonSafely(res);

  if (!res.ok) {
    throw new Error(responseData?.message || 'Не успяхме да запишем абонамента.');
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
    throw new Error(responseData?.message || 'Не успяхме да ви отпишем.');
  }

  return responseData;
}
