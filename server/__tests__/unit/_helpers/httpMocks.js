import { vi } from 'vitest';

export function buildReq(overrides = {}) {
  return {
    headers: {},
    body: {},
    params: {},
    cookies: {},
    socket: {},
    ...overrides,
  };
}

export function buildRes() {
  const res = {
    statusCode: 200,
    headers: {},
  };

  res.status = vi.fn((statusCode) => {
    res.statusCode = statusCode;
    return res;
  });
  res.json = vi.fn((payload) => {
    res.body = payload;
    return res;
  });
  res.setHeader = vi.fn((name, value) => {
    res.headers[name] = value;
    return res;
  });

  return res;
}

export function buildNext() {
  return vi.fn();
}
