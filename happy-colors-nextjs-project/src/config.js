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

const explicitOverride = normalizeAbsoluteUrl(process.env.NEXT_PUBLIC_API_URL);

let baseURL;

if (explicitOverride) {
  baseURL = explicitOverride;
} else if (isServer) {
  const siteApiUrl = getServerSiteApiUrl();

  if (siteApiUrl) {
    baseURL = siteApiUrl;
  } else {
    const port = process.env.PORT || '3000';
    baseURL = `http://localhost:${port}/api`;
  }
} else {
  baseURL = '/api';
}

export default baseURL;
