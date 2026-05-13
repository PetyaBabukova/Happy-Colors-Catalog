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
