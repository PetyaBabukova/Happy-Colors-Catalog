import baseURL from '@/config';
import { createResponseError, readResponseJsonSafely } from '@/utils/errorHandler';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
};

async function readOrThrow(res, fallbackMessage) {
  const data = await readResponseJsonSafely(res);

  if (!res.ok) {
    throw createResponseError(data?.message || fallbackMessage, data);
  }

  return data;
}

export async function getTranslationQueue({ locale = 'en', entityType = '', entityId = '' } = {}) {
  const query = new URLSearchParams({ locale });

  if (entityType) {
    query.set('entityType', entityType);
  }

  if (entityId) {
    query.set('entityId', entityId);
  }

  const res = await fetch(`${baseURL}/translations/queue?${query.toString()}`, {
    credentials: 'include',
    cache: 'no-store',
  });

  return readOrThrow(res, 'Не успяхме да заредим опашката за преводи.');
}

export async function saveManualTranslation({ entityType, entityId, locale = 'en', ...payload }) {
  const res = await fetch(`${baseURL}/translations/${entityType}/${entityId}/${locale}`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  return readOrThrow(res, 'Не успяхме да запазим английския превод.');
}

export async function acceptCurrentTranslation({ entityType, entityId, locale = 'en', ...payload }) {
  const res = await fetch(`${baseURL}/translations/${entityType}/${entityId}/${locale}/accept-current`, {
    method: 'POST',
    headers: JSON_HEADERS,
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  return readOrThrow(res, 'Не успяхме да приемем текущия английски превод.');
}

export async function generateTranslation({ entityType, entityId, locale = 'en', ...payload }) {
  const res = await fetch(`${baseURL}/translations/${entityType}/${entityId}/${locale}/generate`, {
    method: 'POST',
    headers: JSON_HEADERS,
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  return readOrThrow(res, 'Не успяхме да генерираме английския превод.');
}

export async function approveTranslationDraft({ entityType, entityId, locale = 'en', ...payload }) {
  const res = await fetch(`${baseURL}/translations/${entityType}/${entityId}/${locale}/draft/approve`, {
    method: 'POST',
    headers: JSON_HEADERS,
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  return readOrThrow(res, 'Не успяхме да одобрим английската чернова.');
}

export async function rejectTranslationDraft({ entityType, entityId, locale = 'en', ...payload }) {
  const res = await fetch(`${baseURL}/translations/${entityType}/${entityId}/${locale}/draft/reject`, {
    method: 'POST',
    headers: JSON_HEADERS,
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  return readOrThrow(res, 'Не успяхме да отхвърлим английската чернова.');
}
