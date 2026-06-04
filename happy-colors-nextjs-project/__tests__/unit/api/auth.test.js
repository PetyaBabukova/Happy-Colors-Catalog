import { createHmac } from 'crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const findOne = vi.fn();
const objectIdIsValid = vi.fn(() => true);
function objectIdCtor(value) {
  return { objectId: value };
}

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
    vi.clearAllMocks();
    objectIdIsValid.mockReturnValue(true);
    findOne.mockResolvedValue({
      _id: 'user-1',
      username: 'Petya',
      email: 'petya@example.com',
      role: 'full_admin',
    });
    vi.stubEnv('JWT_SECRET', 'jwt-secret');
    vi.doMock('../../../src/app/api/_lib/env.js', () => ({
      ensureServerEnvLoaded: vi.fn(),
    }));
    vi.doMock('../../../src/app/api/_lib/mongo.js', () => ({
      connectToMongo: vi.fn().mockResolvedValue({
        Types: {
          ObjectId: Object.assign(objectIdCtor, { isValid: objectIdIsValid }),
        },
        connection: {
          db: {
            collection: vi.fn(() => ({ findOne })),
          },
        },
      }),
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('accepts a valid HS256 token and returns the canonical database user', async () => {
    const { requireApiAuth } = await loadAuth();
    const token = signToken({
      payload: {
        _id: 'user-1',
        email: 'stale@example.com',
        role: 'artist',
        exp: Math.floor(Date.now() / 1000) + 60,
      },
    });

    await expect(requireApiAuth(requestWithToken(token))).resolves.toMatchObject({
      ok: true,
      user: {
        _id: 'user-1',
        username: 'Petya',
        email: 'petya@example.com',
        role: 'full_admin',
        artistStatus: null,
      },
    });
    expect(findOne).toHaveBeenCalledWith({ _id: { objectId: 'user-1' } });
  });

  it('treats missing stored roles as customer', async () => {
    findOne.mockResolvedValue({
      _id: 'user-2',
      username: 'NoRole',
      email: 'norole@example.com',
    });
    const { requireApiAuth } = await loadAuth();
    const token = signToken({
      payload: { _id: 'user-2', exp: Math.floor(Date.now() / 1000) + 60 },
    });

    await expect(requireApiAuth(requestWithToken(token))).resolves.toMatchObject({
      ok: true,
      user: { role: 'customer', artistStatus: null },
    });
  });

  it.each([
    ['missing token', null],
    ['malformed token', 'not-a-jwt'],
  ])('rejects %s', async (_label, token) => {
    const { requireApiAuth } = await loadAuth();

    await expect(requireApiAuth(requestWithToken(token))).resolves.toMatchObject({ ok: false, status: 401 });
  });

  it.each([
    ['signed token declaring alg none', (payload) => signToken({ header: { alg: 'none', typ: 'JWT' }, payload })],
    ['unsigned alg none token', (payload) => unsignedToken({ header: { alg: 'none', typ: 'JWT' }, payload })],
  ])('rejects unsupported algorithms for %s', async (_label, buildToken) => {
    const { requireApiAuth } = await loadAuth();
    const payload = { _id: 'user-1', exp: Math.floor(Date.now() / 1000) + 60 };

    await expect(requireApiAuth(requestWithToken(buildToken(payload)))).resolves.toMatchObject({
      ok: false,
      message: 'Unsupported token algorithm.',
    });
  });

  it('rejects tampered token signatures', async () => {
    const { requireApiAuth } = await loadAuth();
    const payload = { _id: 'user-1', exp: Math.floor(Date.now() / 1000) + 60 };
    const tamperedToken = `${signToken({ payload }).slice(0, -1)}x`;

    await expect(requireApiAuth(requestWithToken(tamperedToken))).resolves.toMatchObject({
      ok: false,
      message: 'Invalid authentication token.',
    });
  });

  it('rejects missing, expired, and not-yet-active expiration claims', async () => {
    const { requireApiAuth } = await loadAuth();
    const now = Math.floor(Date.now() / 1000);

    await expect(requireApiAuth(requestWithToken(signToken({ payload: { _id: 'user-1' } })))).resolves.toMatchObject({
      ok: false,
      message: 'Authentication token is missing expiration.',
    });
    await expect(
      requireApiAuth(requestWithToken(signToken({ payload: { _id: 'user-1', exp: now - 1 } })))
    ).resolves.toMatchObject({
      ok: false,
      message: 'Authentication token expired.',
    });
    await expect(
      requireApiAuth(requestWithToken(signToken({ payload: { _id: 'user-1', exp: now + 120, nbf: now + 60 } })))
    ).resolves.toMatchObject({
      ok: false,
      message: 'Authentication token is not active yet.',
    });
  });

  it('rejects invalid or missing database users', async () => {
    const { requireApiAuth } = await loadAuth();
    const token = signToken({
      payload: { _id: 'user-1', exp: Math.floor(Date.now() / 1000) + 60 },
    });

    objectIdIsValid.mockReturnValueOnce(false);
    await expect(requireApiAuth(requestWithToken(token))).resolves.toMatchObject({ ok: false, status: 401 });

    objectIdIsValid.mockReturnValueOnce(true);
    findOne.mockResolvedValueOnce(null);
    await expect(requireApiAuth(requestWithToken(token))).resolves.toMatchObject({ ok: false, status: 401 });
  });

  it('returns a server error when JWT_SECRET is missing', async () => {
    vi.stubEnv('JWT_SECRET', '');
    const { requireApiAuth } = await loadAuth();
    const token = signToken({
      payload: { _id: 'user-1', exp: Math.floor(Date.now() / 1000) + 60 },
    });

    await expect(requireApiAuth(requestWithToken(token))).resolves.toMatchObject({
      ok: false,
      status: 500,
      message: 'JWT_SECRET is not configured.',
    });
  });

  it('requires full admin from an authenticated API result', async () => {
    const { requireApiActiveArtistOrFullAdmin, requireApiFullAdmin } = await loadAuth();

    expect(requireApiFullAdmin({ ok: true, user: { role: 'full_admin' } })).toMatchObject({
      ok: true,
    });
    expect(requireApiFullAdmin({ ok: true, user: { role: 'customer' } })).toMatchObject({
      ok: false,
      status: 403,
    });
    expect(requireApiFullAdmin({ ok: false, status: 401 })).toMatchObject({
      ok: false,
      status: 401,
    });

    expect(
      requireApiActiveArtistOrFullAdmin({
        ok: true,
        user: { role: 'artist', artistStatus: 'active' },
      })
    ).toMatchObject({ ok: true });
    expect(
      requireApiActiveArtistOrFullAdmin({
        ok: true,
        user: { role: 'artist', artistStatus: 'pending' },
      })
    ).toMatchObject({ ok: true });
    expect(
      requireApiActiveArtistOrFullAdmin({
        ok: true,
        user: { role: 'artist', artistStatus: 'suspended' },
      })
    ).toMatchObject({ ok: false, status: 403 });
  });
});
