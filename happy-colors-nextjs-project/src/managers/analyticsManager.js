import baseURL from '@/config';
import { createResponseError, readResponseJsonSafely } from '@/utils/errorHandler';

export async function fetchAnalyticsSummary({ refresh = false } = {}) {
  const url = `${baseURL}/analytics/summary${refresh ? '?refresh=1' : ''}`;
  const res = await fetch(url, {
    credentials: 'include',
  });
  const data = await readResponseJsonSafely(res);

  if (!res.ok) {
    throw createResponseError(
      data?.message || 'Неуспешно зареждане на аналитичните данни.',
      data
    );
  }

  return data;
}

export async function fetchNewsletterSubscriberAnalytics({ page = 1, pageSize = 50 } = {}) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  const res = await fetch(`${baseURL}/newsletter/subscribers/analytics?${params.toString()}`, {
    credentials: 'include',
  });
  const data = await readResponseJsonSafely(res);

  if (!res.ok) {
    throw createResponseError(
      data?.message || 'Неуспешно зареждане на данните за абонати.',
      data
    );
  }

  return data;
}

export async function deleteNewsletterSubscriber(subscriberId) {
  const res = await fetch(`${baseURL}/newsletter/subscribers/${encodeURIComponent(subscriberId)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  const data = await readResponseJsonSafely(res);

  if (!res.ok) {
    throw createResponseError(
      data?.message || 'Неуспешно изтриване на абоната.',
      data
    );
  }

  return data;
}
