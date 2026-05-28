import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function loadGoogleAnalyticsHelper() {
  return import('../../../src/app/api/_lib/googleAnalytics.js');
}

function buildReportResponse(rows = []) {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue({ rows }),
  };
}

function buildMetricRow(metricValues, dimensionValues = []) {
  return {
    dimensionValues: dimensionValues.map((value) => ({ value })),
    metricValues: metricValues.map((value) => ({ value: String(value) })),
  };
}

describe('googleAnalytics API helper', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubGlobal('fetch', vi.fn());
    vi.doMock('../../../src/app/api/_lib/env.js', () => ({
      ensureServerEnvLoaded: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns an unconfigured summary when OAuth env values are missing', async () => {
    const { getGoogleAnalyticsSummary } = await loadGoogleAnalyticsHelper();

    await expect(getGoogleAnalyticsSummary()).resolves.toMatchObject({
      configured: false,
      periods: [],
      topPages: [],
      trafficSources: [],
      realtime: { activeUsers: 0 },
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('uses OAuth refresh-token credentials and caches the summary', async () => {
    vi.stubEnv('GOOGLE_ANALYTICS_PROPERTY_ID', '123456789');
    vi.stubEnv('GOOGLE_ANALYTICS_CLIENT_ID', 'client-id.apps.googleusercontent.com');
    vi.stubEnv('GOOGLE_ANALYTICS_CLIENT_SECRET', 'client-secret');
    vi.stubEnv('GOOGLE_ANALYTICS_REFRESH_TOKEN', 'refresh-token');
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          access_token: 'access-token',
          expires_in: 3600,
        }),
      })
      .mockResolvedValueOnce(buildReportResponse([buildMetricRow([5, 12, 7, 240])]))
      .mockResolvedValueOnce(buildReportResponse([buildMetricRow([30, 80, 35, 900])]))
      .mockResolvedValueOnce(buildReportResponse([buildMetricRow([110, 240, 120, 3600])]))
      .mockResolvedValueOnce(
        buildReportResponse([buildMetricRow([45, 20], ['/products', 'Каталог'])])
      )
      .mockResolvedValueOnce(
        buildReportResponse([buildMetricRow([18, 12], ['Organic Search'])])
      )
      .mockResolvedValueOnce(buildReportResponse([buildMetricRow([3])]));

    const { getGoogleAnalyticsSummary } = await loadGoogleAnalyticsHelper();
    const firstSummary = await getGoogleAnalyticsSummary();
    const cachedSummary = await getGoogleAnalyticsSummary();

    expect(fetch).toHaveBeenCalledTimes(7);
    expect(fetch.mock.calls[0]).toEqual([
      'https://oauth2.googleapis.com/token',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(URLSearchParams),
      }),
    ]);
    expect(String(fetch.mock.calls[0][1].body)).toContain('grant_type=refresh_token');
    expect(String(fetch.mock.calls[0][1].body)).toContain('client_id=client-id.apps.googleusercontent.com');
    expect(String(fetch.mock.calls[0][1].body)).toContain('refresh_token=refresh-token');
    expect(firstSummary).toMatchObject({
      configured: true,
      cached: false,
      realtime: { activeUsers: 3 },
      topPages: [{ path: '/products', title: 'Каталог', pageViews: 45, activeUsers: 20 }],
      trafficSources: [{ source: 'Organic Search', sessions: 18, activeUsers: 12 }],
    });
    expect(firstSummary.periods).toHaveLength(3);
    expect(cachedSummary).toMatchObject({
      configured: true,
      cached: true,
    });
  });

  it('force refresh bypasses the cached summary but reuses a valid access token', async () => {
    vi.stubEnv('GOOGLE_ANALYTICS_PROPERTY_ID', '123456789');
    vi.stubEnv('GOOGLE_ANALYTICS_CLIENT_ID', 'client-id.apps.googleusercontent.com');
    vi.stubEnv('GOOGLE_ANALYTICS_CLIENT_SECRET', 'client-secret');
    vi.stubEnv('GOOGLE_ANALYTICS_REFRESH_TOKEN', 'refresh-token');
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          access_token: 'access-token',
          expires_in: 3600,
        }),
      })
      .mockResolvedValue(buildReportResponse());

    const { getGoogleAnalyticsSummary } = await loadGoogleAnalyticsHelper();

    await getGoogleAnalyticsSummary();
    await getGoogleAnalyticsSummary({ forceRefresh: true });

    expect(fetch).toHaveBeenCalledTimes(13);
    expect(
      fetch.mock.calls.filter(([url]) => url === 'https://oauth2.googleapis.com/token')
    ).toHaveLength(1);
  });

  it('returns a safe OAuth error message without exposing credentials', async () => {
    vi.stubEnv('GOOGLE_ANALYTICS_PROPERTY_ID', '123456789');
    vi.stubEnv('GOOGLE_ANALYTICS_CLIENT_ID', 'client-id.apps.googleusercontent.com');
    vi.stubEnv('GOOGLE_ANALYTICS_CLIENT_SECRET', 'client-secret');
    vi.stubEnv('GOOGLE_ANALYTICS_REFRESH_TOKEN', 'refresh-token');
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: vi.fn().mockResolvedValue({
        error: 'invalid_grant',
        error_description: 'Bad Request',
      }),
    });

    const { getGoogleAnalyticsSummary } = await loadGoogleAnalyticsHelper();

    await expect(getGoogleAnalyticsSummary()).rejects.toMatchObject({
      code: 'google_analytics_oauth_failed',
      message: 'Google Analytics OAuth authorization failed: invalid_grant: Bad Request',
    });
  });

  it('returns a safe report error when Google Analytics rejects a report request', async () => {
    vi.stubEnv('GOOGLE_ANALYTICS_PROPERTY_ID', '123456789');
    vi.stubEnv('GOOGLE_ANALYTICS_CLIENT_ID', 'client-id.apps.googleusercontent.com');
    vi.stubEnv('GOOGLE_ANALYTICS_CLIENT_SECRET', 'client-secret');
    vi.stubEnv('GOOGLE_ANALYTICS_REFRESH_TOKEN', 'refresh-token');
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          access_token: 'access-token',
          expires_in: 3600,
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: vi.fn().mockResolvedValue({
          error: {
            status: 'PERMISSION_DENIED',
            message: 'User does not have sufficient permissions for this property.',
          },
        }),
      })
      .mockResolvedValue(buildReportResponse());

    const { getGoogleAnalyticsSummary } = await loadGoogleAnalyticsHelper();

    await expect(getGoogleAnalyticsSummary()).rejects.toMatchObject({
      name: 'GoogleAnalyticsError',
      code: 'google_analytics_report_failed',
      status: 403,
      message:
        'Google Analytics report request failed: PERMISSION_DENIED: User does not have sufficient permissions for this property.',
    });
  });

  it('refreshes the access token when the cached token is near expiry', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-28T08:00:00.000Z'));
    vi.stubEnv('GOOGLE_ANALYTICS_PROPERTY_ID', '123456789');
    vi.stubEnv('GOOGLE_ANALYTICS_CLIENT_ID', 'client-id.apps.googleusercontent.com');
    vi.stubEnv('GOOGLE_ANALYTICS_CLIENT_SECRET', 'client-secret');
    vi.stubEnv('GOOGLE_ANALYTICS_REFRESH_TOKEN', 'refresh-token');
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          access_token: 'first-access-token',
          expires_in: 30,
        }),
      })
      .mockResolvedValueOnce(buildReportResponse())
      .mockResolvedValueOnce(buildReportResponse())
      .mockResolvedValueOnce(buildReportResponse())
      .mockResolvedValueOnce(buildReportResponse())
      .mockResolvedValueOnce(buildReportResponse())
      .mockResolvedValueOnce(buildReportResponse())
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          access_token: 'second-access-token',
          expires_in: 3600,
        }),
      })
      .mockResolvedValue(buildReportResponse());

    const { getGoogleAnalyticsSummary } = await loadGoogleAnalyticsHelper();

    await getGoogleAnalyticsSummary();
    await getGoogleAnalyticsSummary({ forceRefresh: true });

    expect(
      fetch.mock.calls.filter(([url]) => url === 'https://oauth2.googleapis.com/token')
    ).toHaveLength(2);
  });
});
