import { ensureServerEnvLoaded } from './env';

const ACCESS_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ANALYTICS_DATA_API_BASE_URL = 'https://analyticsdata.googleapis.com/v1beta';
const CACHE_TTL_MS = 10 * 60 * 1000;
const TOKEN_EXPIRY_SAFETY_MS = 60 * 1000;

let cachedAccessToken = null;
let cachedSummary = null;

class GoogleAnalyticsError extends Error {
  constructor(message, { code = 'google_analytics_error', status = 500 } = {}) {
    super(message);
    this.name = 'GoogleAnalyticsError';
    this.code = code;
    this.status = status;
  }
}

async function readGoogleError(response) {
  try {
    const data = await response.json();
    const errorCode =
      typeof data?.error === 'string' ? data.error : data?.error?.status || data?.error?.code || '';
    const errorMessage = data?.error_description || data?.error?.message || '';

    return [errorCode, errorMessage].filter(Boolean).join(': ');
  } catch {
    return '';
  }
}

function getAnalyticsConfig() {
  ensureServerEnvLoaded();

  const propertyId = String(process.env.GOOGLE_ANALYTICS_PROPERTY_ID || '').trim();
  const clientId = String(process.env.GOOGLE_ANALYTICS_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.GOOGLE_ANALYTICS_CLIENT_SECRET || '').trim();
  const refreshToken = String(process.env.GOOGLE_ANALYTICS_REFRESH_TOKEN || '').trim();

  return {
    configured: Boolean(propertyId && clientId && clientSecret && refreshToken),
    cacheKey: `${propertyId}:${clientId}`,
    propertyId,
    clientId,
    clientSecret,
    refreshToken,
  };
}

async function getAccessToken(config) {
  if (
    cachedAccessToken &&
    cachedAccessToken.cacheKey === config.cacheKey &&
    cachedAccessToken.expiresAt > Date.now() + TOKEN_EXPIRY_SAFETY_MS
  ) {
    return cachedAccessToken.value;
  }

  const response = await fetch(ACCESS_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const googleMessage = await readGoogleError(response);

    throw new GoogleAnalyticsError(
      googleMessage
        ? `Google Analytics OAuth authorization failed: ${googleMessage}`
        : 'Google Analytics OAuth authorization failed.',
      { code: 'google_analytics_oauth_failed', status: response.status }
    );
  }

  const data = await response.json();
  const expiresInSeconds = Number(data?.expires_in || 0);

  if (!data?.access_token || !expiresInSeconds) {
    throw new GoogleAnalyticsError('Google Analytics authorization returned an invalid response.', {
      code: 'google_analytics_oauth_invalid_response',
      status: 502,
    });
  }

  cachedAccessToken = {
    cacheKey: config.cacheKey,
    value: data.access_token,
    expiresAt: Date.now() + expiresInSeconds * 1000,
  };

  return cachedAccessToken.value;
}

async function runAnalyticsReport(config, token, body, method = 'runReport') {
  const response = await fetch(
    `${ANALYTICS_DATA_API_BASE_URL}/properties/${config.propertyId}:${method}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const googleMessage = await readGoogleError(response);

    throw new GoogleAnalyticsError(
      googleMessage
        ? `Google Analytics report request failed: ${googleMessage}`
        : 'Google Analytics report request failed.',
      { code: 'google_analytics_report_failed', status: response.status }
    );
  }

  return response.json();
}

function metricValue(row, index) {
  return Number(row?.metricValues?.[index]?.value || 0);
}

function dimensionValue(row, index) {
  return String(row?.dimensionValues?.[index]?.value || '');
}

function roundMetric(value, decimals = 0) {
  const factor = 10 ** decimals;

  return Math.round(value * factor) / factor;
}

function summarizePeriodResponse(response, label) {
  const row = response?.rows?.[0] || {};
  const activeUsers = metricValue(row, 0);
  const pageViews = metricValue(row, 1);
  const sessions = metricValue(row, 2);
  const engagementSeconds = metricValue(row, 3);

  return {
    label,
    activeUsers,
    pageViews,
    sessions,
    averageEngagementSeconds: activeUsers
      ? roundMetric(engagementSeconds / activeUsers, 1)
      : 0,
  };
}

function summarizeTopPages(response) {
  return (response?.rows || []).map((row) => ({
    path: dimensionValue(row, 0) || '/',
    title: dimensionValue(row, 1) || 'Без заглавие',
    pageViews: metricValue(row, 0),
    activeUsers: metricValue(row, 1),
  }));
}

function summarizeTrafficSources(response) {
  return (response?.rows || []).map((row) => ({
    source: dimensionValue(row, 0) || 'Unassigned',
    sessions: metricValue(row, 0),
    activeUsers: metricValue(row, 1),
  }));
}

function summarizeRealtime(response) {
  return {
    activeUsers: (response?.rows || []).reduce((sum, row) => sum + metricValue(row, 0), 0),
  };
}

function emptySummary(configured = false) {
  return {
    configured,
    generatedAt: new Date().toISOString(),
    cacheTtlSeconds: CACHE_TTL_MS / 1000,
    periods: [],
    topPages: [],
    trafficSources: [],
    realtime: {
      activeUsers: 0,
    },
  };
}

export async function getGoogleAnalyticsSummary({ forceRefresh = false } = {}) {
  const config = getAnalyticsConfig();

  if (!config.configured) {
    return emptySummary(false);
  }

  if (
    !forceRefresh &&
    cachedSummary &&
    cachedSummary.cacheKey === config.cacheKey &&
    cachedSummary.expiresAt > Date.now()
  ) {
    return {
      ...cachedSummary.value,
      cached: true,
    };
  }

  const token = await getAccessToken(config);
  const dateRangeRequests = [
    ['Днес', 'today'],
    ['7 дни', '7daysAgo'],
    ['30 дни', '30daysAgo'],
  ].map(([label, startDate]) =>
    runAnalyticsReport(config, token, {
      dateRanges: [{ startDate, endDate: 'today' }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'screenPageViews' },
        { name: 'sessions' },
        { name: 'userEngagementDuration' },
      ],
    }).then((response) => summarizePeriodResponse(response, label))
  );
  const topPagesRequest = runAnalyticsReport(config, token, {
    dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
    metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit: 10,
  }).then(summarizeTopPages);
  const trafficSourcesRequest = runAnalyticsReport(config, token, {
    dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'sessionDefaultChannelGroup' }],
    metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 8,
  }).then(summarizeTrafficSources);
  const realtimeRequest = runAnalyticsReport(
    config,
    token,
    {
      metrics: [{ name: 'activeUsers' }],
    },
    'runRealtimeReport'
  ).then(summarizeRealtime);

  const [periods, topPages, trafficSources, realtime] = await Promise.all([
    Promise.all(dateRangeRequests),
    topPagesRequest,
    trafficSourcesRequest,
    realtimeRequest,
  ]);
  const summary = {
    configured: true,
    cached: false,
    generatedAt: new Date().toISOString(),
    cacheTtlSeconds: CACHE_TTL_MS / 1000,
    periods,
    topPages,
    trafficSources,
    realtime,
  };

  cachedSummary = {
    cacheKey: config.cacheKey,
    value: summary,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };

  return summary;
}

export function resetGoogleAnalyticsCacheForTests() {
  cachedAccessToken = null;
  cachedSummary = null;
}
