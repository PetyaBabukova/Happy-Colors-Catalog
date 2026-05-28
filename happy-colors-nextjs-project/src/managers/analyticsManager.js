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
