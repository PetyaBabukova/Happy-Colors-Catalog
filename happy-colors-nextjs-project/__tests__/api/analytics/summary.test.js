import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createJsonRequest, readJson } from '../_helpers.js';

const requireApiAuth = vi.fn();
const getGoogleAnalyticsSummary = vi.fn();
let authResult;

async function loadRoute() {
  return import('../../../src/app/api/analytics/summary/route.js');
}

describe('/api/analytics/summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authResult = { ok: true, user: { _id: 'admin-1', role: 'full_admin' } };
    requireApiAuth.mockImplementation(() => authResult);
    getGoogleAnalyticsSummary.mockResolvedValue({
      configured: true,
      cached: false,
      periods: [],
      topPages: [],
      trafficSources: [],
      realtime: { activeUsers: 0 },
    });

    vi.doMock('../../../src/app/api/_lib/auth.js', () => ({
      requireApiAuth,
      requireApiFullAdmin: vi.fn((auth) =>
        auth.ok && auth.user?.role !== 'full_admin'
          ? { ok: false, status: 403, message: 'Forbidden.' }
          : auth
      ),
    }));
    vi.doMock('../../../src/app/api/_lib/googleAnalytics.js', () => ({
      getGoogleAnalyticsSummary,
    }));
  });

  it('returns the analytics summary for full admins', async () => {
    const { GET } = await loadRoute();

    const response = await GET(createJsonRequest(null, { url: 'http://test.local/api/analytics/summary' }));

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=0, no-store');
    await expect(readJson(response)).resolves.toMatchObject({ configured: true });
    expect(getGoogleAnalyticsSummary).toHaveBeenCalledWith({ forceRefresh: false });
  });

  it('passes force refresh when requested', async () => {
    const { GET } = await loadRoute();

    const response = await GET(
      createJsonRequest(null, { url: 'http://test.local/api/analytics/summary?refresh=1' })
    );

    expect(response.status).toBe(200);
    expect(getGoogleAnalyticsSummary).toHaveBeenCalledWith({ forceRefresh: true });
  });

  it('rejects non-full-admin users', async () => {
    authResult = { ok: true, user: { _id: 'user-1', role: 'customer' } };
    const { GET } = await loadRoute();

    const response = await GET(createJsonRequest(null, { url: 'http://test.local/api/analytics/summary' }));

    expect(response.status).toBe(403);
    expect(getGoogleAnalyticsSummary).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated requests', async () => {
    authResult = { ok: false, status: 401, message: 'Not authenticated.' };
    const { GET } = await loadRoute();

    const response = await GET(createJsonRequest(null, { url: 'http://test.local/api/analytics/summary' }));

    expect(response.status).toBe(401);
    await expect(readJson(response)).resolves.toEqual({ message: 'Not authenticated.' });
    expect(getGoogleAnalyticsSummary).not.toHaveBeenCalled();
  });

  it('returns safe analytics failure details', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    getGoogleAnalyticsSummary.mockRejectedValueOnce(
      Object.assign(new Error('Google Analytics OAuth authorization failed: Bad Request'), {
        name: 'GoogleAnalyticsError',
        code: 'google_analytics_oauth_failed',
        status: 400,
      })
    );
    const { GET } = await loadRoute();

    const response = await GET(createJsonRequest(null, { url: 'http://test.local/api/analytics/summary' }));

    expect(response.status).toBe(400);
    await expect(readJson(response)).resolves.toEqual({
      message: 'Google Analytics OAuth authorization failed: Bad Request',
      code: 'google_analytics_oauth_failed',
    });
    expect(console.error).toHaveBeenCalledWith(
      'Error in /api/analytics/summary:',
      expect.any(Error)
    );
  });

  it('does not expose unexpected error details to the client', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    getGoogleAnalyticsSummary.mockRejectedValueOnce(new Error('database password leaked in stack'));
    const { GET } = await loadRoute();

    const response = await GET(createJsonRequest(null, { url: 'http://test.local/api/analytics/summary' }));

    expect(response.status).toBe(500);
    await expect(readJson(response)).resolves.toEqual({
      message: 'Неуспешно зареждане на аналитичните данни.',
      code: 'analytics_summary_failed',
    });
  });
});
