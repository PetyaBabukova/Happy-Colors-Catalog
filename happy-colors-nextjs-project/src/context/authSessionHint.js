import { AUTH_COOKIE_NAME } from '../../../shared/authConstants.js';

export { AUTH_COOKIE_NAME };

export function hasAuthSessionHint(cookieStore) {
  return Boolean(cookieStore?.has?.(AUTH_COOKIE_NAME));
}
