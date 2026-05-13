import { createHmac } from 'crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function base64url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function signToken({ header = { alg: 'HS256', typ: 'JWT' }, payload, secret = 'jwt-secret' }) {
  const encodedHeader = base64url(header);
  const encodedPayload = base64url(payload);
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac('sha256', secret).update(unsignedToken).digest('base64url');

  return `${unsignedToken}.${signature}`;
}

function unsignedToken({ header, payload }) {
  return `${base64url(header)}.${base64url(payload)}.`;
}

function requestWithToken(token) {
  return {
    cookies: {
      get: vi.fn(() => (token ? { value: token } : undefined)),
    },
  };
}

async function loadAuth() {
  return import('../../../src/app/api/_lib/auth.js');
}

describe('api auth helper', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('JWT_SECRET', 'jwt-secret');
    vi.doMock('../../../src/app/api/_lib/env.js', () => ({
      ensureServerEnvLoaded: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('accepts a valid HS256 token and returns its payload', async () => {
    const { requireApiAuth } = await loadAuth();
    const token = signToken({
      payload: {
        _id: 'user-1',
        email: 'petya@example.com',
        exp: Math.floor(Date.now() / 1000) + 60,
      },
    });

    expect(requireApiAuth(requestWithToken(token))).toMatchObject({
      ok: true,
      user: {
        _id: 'user-1',
        email: 'petya@example.com',
      },
    });
  });

  it.each([
    ['missing token', null],
    ['malformed token', 'not-a-jwt'],
  ])('rejects %s', async (_label, token) => {
    const { requireApiAuth } = await loadAuth();

    expect(requireApiAuth(requestWithToken(token))).toMatchObject({ ok: false, status: 401 });
  });

  it.each([
    ['signed token declaring alg none', (payload) => signToken({ header: { alg: 'none', typ: 'JWT' }, payload })],
    ['unsigned alg none token', (payload) => unsignedToken({ header: { alg: 'none', typ: 'JWT' }, payload })],
  ])('rejects unsupported algorithms for %s', async (_label, buildToken) => {
    const { requireApiAuth } = await loadAuth();
    const payload = { _id: 'user-1', exp: Math.floor(Date.now() / 1000) + 60 };

    expect(requireApiAuth(requestWithToken(buildToken(payload)))).toMatchObject({
      ok: false,
      message: 'Unsupported token algorithm.',
    });
  });

  it('rejects tampered token signatures', async () => {
    const { requireApiAuth } = await loadAuth();
    const payload = { _id: 'user-1', exp: Math.floor(Date.now() / 1000) + 60 };
    const tamperedToken = `${signToken({ payload }).slice(0, -1)}x`;

    expect(requireApiAuth(requestWithToken(tamperedToken))).toMatchObject({
      ok: false,
      message: 'Invalid authentication token.',
    });
  });

  it('rejects missing, expired, and not-yet-active expiration claims', async () => {
    const { requireApiAuth } = await loadAuth();
    const now = Math.floor(Date.now() / 1000);

    expect(requireApiAuth(requestWithToken(signToken({ payload: { _id: 'user-1' } })))).toMatchObject({
      ok: false,
      message: 'Authentication token is missing expiration.',
    });
    expect(requireApiAuth(requestWithToken(signToken({ payload: { _id: 'user-1', exp: now - 1 } })))).toMatchObject({
      ok: false,
      message: 'Authentication token expired.',
    });
    expect(
      requireApiAuth(requestWithToken(signToken({ payload: { _id: 'user-1', exp: now + 120, nbf: now + 60 } })))
    ).toMatchObject({
      ok: false,
      message: 'Authentication token is not active yet.',
    });
  });

  it('returns a server error when JWT_SECRET is missing', async () => {
    vi.stubEnv('JWT_SECRET', '');
    const { requireApiAuth } = await loadAuth();
    const token = signToken({
      payload: { _id: 'user-1', exp: Math.floor(Date.now() / 1000) + 60 },
    });

    expect(requireApiAuth(requestWithToken(token))).toMatchObject({
      ok: false,
      status: 500,
      message: 'JWT_SECRET is not configured.',
    });
  });
});
