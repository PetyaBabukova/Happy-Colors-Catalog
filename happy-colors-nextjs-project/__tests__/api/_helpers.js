import { vi } from 'vitest';

export function jsonResponse({ ok = true, status = ok ? 200 : 400, body = {} } = {}) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  };
}

export function createJsonRequest(body, overrides = {}) {
  return {
    json: async () => body,
    headers: {
      get: () => null,
    },
    cookies: {
      get: () => undefined,
    },
    ...overrides,
  };
}

export function createInvalidJsonRequest(overrides = {}) {
  return {
    json: async () => {
      throw new Error('Invalid JSON');
    },
    headers: {
      get: () => null,
    },
    cookies: {
      get: () => undefined,
    },
    ...overrides,
  };
}

export function createGetRequest(url) {
  return {
    nextUrl: new URL(url),
  };
}

export async function readJson(response) {
  return response.json();
}
