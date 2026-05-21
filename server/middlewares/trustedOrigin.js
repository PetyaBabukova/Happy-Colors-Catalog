const DEFAULT_PUBLIC_SITE_URL = 'https://happycolors.eu';

function normalizeOrigin(value) {
  const rawValue = String(value || '').trim();

  if (!rawValue) {
    return '';
  }

  try {
    return new URL(rawValue).origin.replace(/\/+$/, '');
  } catch {
    return rawValue.replace(/\/+$/, '');
  }
}

function isLocalOrigin(origin = '') {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

function getTrustedOrigins() {
  const isProduction = process.env.NODE_ENV === 'production';
  const clientUrlOrigin = normalizeOrigin(process.env.CLIENT_URL);
  const configuredOrigins = String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);

  const defaults = [
    process.env.NEWSLETTER_PUBLIC_SITE_URL || DEFAULT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.RENDER_EXTERNAL_URL,
    isProduction && isLocalOrigin(clientUrlOrigin) ? '' : clientUrlOrigin,
  ]
    .map(normalizeOrigin)
    .filter(Boolean);

  return new Set([...configuredOrigins, ...defaults]);
}

function getRequestOrigin(req) {
  const origin = normalizeOrigin(req.get('origin'));

  if (origin) {
    return origin;
  }

  const referer = String(req.get('referer') || '').trim();

  if (!referer) {
    return '';
  }

  try {
    return new URL(referer).origin.replace(/\/+$/, '');
  } catch {
    return 'invalid-referer';
  }
}

export function requireTrustedOrigin(req, res, next) {
  const requestOrigin = getRequestOrigin(req);
  const trustedOrigins = getTrustedOrigins();
  const isProduction = process.env.NODE_ENV === 'production';
  const allowsLocalDevOrigins = ['development', 'test'].includes(process.env.NODE_ENV);
  const allowsMissingOrigin =
    allowsLocalDevOrigins || (!process.env.NODE_ENV && isLocalOrigin(normalizeOrigin(process.env.CLIENT_URL)));

  if (!requestOrigin) {
    if (isProduction || !allowsMissingOrigin) {
      return res.status(403).json({ message: 'Untrusted request origin.' });
    }

    return next();
  }

  if (allowsLocalDevOrigins && isLocalOrigin(requestOrigin)) {
    return next();
  }

  if (!trustedOrigins.has(requestOrigin)) {
    return res.status(403).json({ message: 'Untrusted request origin.' });
  }

  return next();
}
