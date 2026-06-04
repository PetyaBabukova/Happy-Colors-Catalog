import baseURL from '@/config';
import { createResponseError, readResponseJsonSafely } from '@/utils/errorHandler';

async function assertAdminResponse(res, fallbackMessage) {
  const data = await readResponseJsonSafely(res);

  if (!res.ok) {
    throw createResponseError(data?.message || fallbackMessage, data);
  }

  return data;
}

export async function fetchAdminUsers() {
  const res = await fetch(`${baseURL}/users/admin`, {
    credentials: 'include',
  });

  return assertAdminResponse(res, 'Неуспешно зареждане на потребителите.');
}

export async function fetchAdminUserDossier(userId) {
  const res = await fetch(`${baseURL}/users/admin/${userId}`, {
    credentials: 'include',
  });

  return assertAdminResponse(res, 'Неуспешно зареждане на потребителското досие.');
}

export async function updateAdminUser(userId, payload) {
  const res = await fetch(`${baseURL}/users/admin/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  return assertAdminResponse(res, 'Неуспешно обновяване на потребителя.');
}

export async function fetchAdminReviewProduct(productId) {
  const res = await fetch(`${baseURL}/products/mine/${productId}`, {
    credentials: 'include',
  });

  return assertAdminResponse(res, 'Неуспешно зареждане на продукта за преглед.');
}

export async function approveAdminProduct(productId) {
  const res = await fetch(`${baseURL}/products/${productId}/approve`, {
    method: 'PATCH',
    credentials: 'include',
  });

  return assertAdminResponse(res, 'Неуспешно одобряване на продукта.');
}

export async function rejectAdminProduct(productId, reviewNote) {
  const res = await fetch(`${baseURL}/products/${productId}/reject`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ reviewNote }),
  });

  return assertAdminResponse(res, 'Неуспешен отказ за публикация.');
}
