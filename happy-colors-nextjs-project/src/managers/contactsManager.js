import baseURL from '@/config';
import { createResponseError, readResponseJsonSafely } from '@/utils/errorHandler';

export async function sendContactForm(data) {
  const res = await fetch(`${baseURL}/contacts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  const responseData = await readResponseJsonSafely(res);

  if (!res.ok) {
    throw createResponseError(responseData?.message || 'Грешка при изпращането', {
      status: res.status,
      data: responseData,
    });
  }

  return responseData;
}
