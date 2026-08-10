import { createCartoonUploadGuardTools } from '../../../../../shared/cartoonUploadGuardsCore.js';

import { ensureServerEnvLoaded } from './env';

const guardTools = createCartoonUploadGuardTools({
  getEnvValue: (name) => process.env[name],
  prepareEnv: ensureServerEnvLoaded,
});

export const arePersistentCartoonGuardsEnabled = guardTools.arePersistentCartoonGuardsEnabled;
export const createCartoonGuardHmacKey = guardTools.createCartoonGuardHmacKey;
export const createBrowserGuardCookieValue = guardTools.createBrowserGuardCookieValue;
export const getBrowserGuardCookieName = guardTools.getBrowserGuardCookieName;
export const getBrowserGuardCookieMaxAgeSeconds = guardTools.getBrowserGuardCookieMaxAgeSeconds;
export const getBrowserGuardCookieOptions = guardTools.getBrowserGuardCookieOptions;

export function setBrowserGuardCookie(response, value = createBrowserGuardCookieValue()) {
  response.cookies.set(getBrowserGuardCookieName(), value, getBrowserGuardCookieOptions());

  return value;
}

export function getTrustedClientIpFromNextRequest(request) {
  const headerName = guardTools.getTrustedClientIpHeaderName();
  const value = request?.headers?.get?.(headerName);

  return guardTools.getTrustedClientIpFromHeaderValue(value);
}
