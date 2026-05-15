const isServer = typeof window === 'undefined';

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

function normalizeAbsoluteUrl(value) {
  const rawValue = String(value || '').trim();

  if (!rawValue) {
    return '';
  }

  return stripTrailingSlash(rawValue);
}

function getServerSiteApiUrl() {
  const siteUrl =
    normalizeAbsoluteUrl(process.env.NEXT_PUBLIC_SITE_URL) ||
    normalizeAbsoluteUrl(process.env.RENDER_EXTERNAL_URL) ||
    normalizeAbsoluteUrl(process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');

  if (siteUrl) {
    return `${siteUrl}/api`;
  }

  return '';
}

const explicitServerOverride =
  normalizeAbsoluteUrl(process.env.NEXT_PUBLIC_API_URL) ||
  normalizeAbsoluteUrl(process.env.NEXT_PUBLIC_BASE_URL);

let baseURL;

if (!isServer) {
  baseURL = '/api';
} else if (explicitServerOverride) {
  baseURL = explicitServerOverride;
} else {
  const siteApiUrl = getServerSiteApiUrl();

  if (siteApiUrl) {
    baseURL = siteApiUrl;
  } else {
    const port = process.env.PORT || '3000';
    baseURL = `http://localhost:${port}/api`;
  }
}

export default baseURL;
