import { createCartoonUploadGuardTools } from '../../shared/cartoonUploadGuardsCore.js';

const guardTools = createCartoonUploadGuardTools({
  getEnvValue: (name) => process.env[name],
});

export const arePersistentCartoonGuardsEnabled = guardTools.arePersistentCartoonGuardsEnabled;
export const createCartoonGuardHmacKey = guardTools.createCartoonGuardHmacKey;
export const createBrowserGuardCookieValue = guardTools.createBrowserGuardCookieValue;
export const getBrowserGuardCookieName = guardTools.getBrowserGuardCookieName;
export const getBrowserGuardCookieMaxAgeSeconds = guardTools.getBrowserGuardCookieMaxAgeSeconds;
export const getBrowserGuardCookieOptions = guardTools.getBrowserGuardCookieOptions;

export function serializeBrowserGuardCookie(value = createBrowserGuardCookieValue()) {
  const options = getBrowserGuardCookieOptions();
  const parts = [
    `${getBrowserGuardCookieName()}=${encodeURIComponent(value)}`,
    `Max-Age=${options.maxAge}`,
    `Path=${options.path}`,
  ];

  if (options.httpOnly) {
    parts.push('HttpOnly');
  }

  parts.push(`SameSite=${options.sameSite === 'strict' ? 'Strict' : 'Lax'}`);

  if (options.secure) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

export function getTrustedClientIpFromExpressRequest(req) {
  const headerName = guardTools.getTrustedClientIpHeaderName();
  const rawValue = req?.headers?.[headerName];
  const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;

  return guardTools.getTrustedClientIpFromHeaderValue(value);
}
