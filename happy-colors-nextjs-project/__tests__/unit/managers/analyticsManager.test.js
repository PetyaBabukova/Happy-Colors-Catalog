import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchAnalyticsSummary,
  fetchNewsletterSubscriberAnalytics,
} from '../../../src/managers/analyticsManager.js';

function jsonResponse({ ok = true, body = {} } = {}) {
  return {
    ok,
    json: vi.fn().mockResolvedValue(body),
  };
}

describe('analyticsManager', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('fetches Google Analytics summaries', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ body: { configured: true } }));

    await expect(fetchAnalyticsSummary({ refresh: true })).resolves.toEqual({ configured: true });

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/analytics/summary?refresh=1',
      expect.objectContaining({ credentials: 'include' })
    );
  });

  it('fetches newsletter subscriber analytics with auth cookies', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ body: { subscribers: [] } }));

    await expect(fetchNewsletterSubscriberAnalytics({ page: 2, pageSize: 25 })).resolves.toEqual({
      subscribers: [],
    });

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/newsletter/subscribers/analytics?page=2&pageSize=25',
      expect.objectContaining({ credentials: 'include' })
    );
  });

  it('preserves subscriber analytics error metadata', async () => {
    fetch.mockResolvedValueOnce(
      jsonResponse({ ok: false, body: { message: 'Forbidden', code: 'forbidden' } })
    );

    let error;

    try {
      await fetchNewsletterSubscriberAnalytics();
    } catch (caughtError) {
      error = caughtError;
    }

    expect(error.message).toBe('Forbidden');
    expect(error.code).toBe('forbidden');
  });
});
