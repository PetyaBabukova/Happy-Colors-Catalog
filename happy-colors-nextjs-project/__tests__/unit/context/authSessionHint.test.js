import { describe, expect, it, vi } from 'vitest';
import { AUTH_COOKIE_NAME, hasAuthSessionHint } from '../../../src/context/authSessionHint.js';

describe('auth session hint', () => {
  it('returns false without the auth cookie', () => {
    const cookieStore = { has: vi.fn(() => false) };

    expect(hasAuthSessionHint(cookieStore)).toBe(false);
    expect(cookieStore.has).toHaveBeenCalledWith(AUTH_COOKIE_NAME);
  });

  it('returns true when the auth cookie exists without reading its value', () => {
    const cookieStore = {
      has: vi.fn((name) => name === AUTH_COOKIE_NAME),
      get: vi.fn(),
    };

    expect(hasAuthSessionHint(cookieStore)).toBe(true);
    expect(cookieStore.has).toHaveBeenCalledWith(AUTH_COOKIE_NAME);
    expect(cookieStore.get).not.toHaveBeenCalled();
  });
});
