import { createHmac } from 'crypto';
import { describe, expect, it, vi } from 'vitest';

import {
  getRequiredJwtSecret,
  verifyHs256JwtPayload,
} from '../../../../shared/authJwtCore.js';

function encodeSegment(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function signToken(payload, { secret = 'unit-jwt-secret', header = { alg: 'HS256', typ: 'JWT' } } = {}) {
  const encodedHeader = encodeSegment(header);
  const encodedPayload = encodeSegment(payload);
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac('sha256', secret).update(unsignedToken).digest('base64url');

  return `${unsignedToken}.${signature}`;
}

describe('shared auth JWT core', () => {
  it('loads required JWT secrets through injected env readers', () => {
    vi.stubEnv('JWT_SECRET', 'process-secret-that-should-not-be-used');
    const prepareEnv = vi.fn();
    const getEnvValue = vi.fn((name) => (name === 'JWT_SECRET' ? 'injected-secret' : ''));

    expect(getRequiredJwtSecret({ getEnvValue, prepareEnv })).toBe('injected-secret');
    expect(getEnvValue).toHaveBeenCalledWith('JWT_SECRET');
    expect(prepareEnv).toHaveBeenCalledOnce();

    vi.unstubAllEnvs();
  });

  it('throws the configured error message when JWT secret is missing', () => {
    expect(() => getRequiredJwtSecret({
      getEnvValue: () => '',
      errorMessage: 'custom missing secret',
    })).toThrow('custom missing secret');
  });

  it('verifies valid HS256 JWT payloads with injected secrets', () => {
    const token = signToken({ _id: 'user-1', exp: 200, nbf: 50 });

    expect(verifyHs256JwtPayload({
      token,
      getJwtSecret: () => 'unit-jwt-secret',
      nowInSeconds: 100,
    })).toEqual({
      ok: true,
      payload: { _id: 'user-1', exp: 200, nbf: 50 },
    });
  });

  it('rejects missing, malformed, unsupported, and tampered tokens', () => {
    const token = signToken({ _id: 'user-1', exp: 200 });
    const noneToken = signToken({ _id: 'user-1', exp: 200 }, { header: { alg: 'none' } });
    const tamperedToken = token.replace(/\.[^.]+$/, '.bad-signature');

    expect(verifyHs256JwtPayload({ token: '' })).toMatchObject({
      ok: false,
      status: 401,
      message: 'Missing authentication token.',
    });
    expect(verifyHs256JwtPayload({ token: 'not-a-jwt' })).toMatchObject({
      ok: false,
      status: 401,
      message: 'Invalid authentication token.',
    });
    expect(verifyHs256JwtPayload({
      token: noneToken,
      getJwtSecret: () => 'unit-jwt-secret',
    })).toMatchObject({
      ok: false,
      status: 401,
      message: 'Unsupported token algorithm.',
    });
    expect(verifyHs256JwtPayload({
      token: tamperedToken,
      getJwtSecret: () => 'unit-jwt-secret',
    })).toMatchObject({
      ok: false,
      status: 401,
      message: 'Invalid authentication token.',
    });
  });

  it('rejects invalid token timing claims', () => {
    expect(verifyHs256JwtPayload({
      token: signToken({ _id: 'user-1' }),
      getJwtSecret: () => 'unit-jwt-secret',
      nowInSeconds: 100,
    })).toMatchObject({ ok: false, message: 'Authentication token is missing expiration.' });

    expect(verifyHs256JwtPayload({
      token: signToken({ _id: 'user-1', exp: 'soon' }),
      getJwtSecret: () => 'unit-jwt-secret',
      nowInSeconds: 100,
    })).toMatchObject({ ok: false, message: 'Authentication token is missing expiration.' });

    expect(verifyHs256JwtPayload({
      token: signToken({ _id: 'user-1', exp: 200, nbf: 'later' }),
      getJwtSecret: () => 'unit-jwt-secret',
      nowInSeconds: 100,
    })).toMatchObject({ ok: false, message: 'Authentication token is not active yet.' });

    expect(verifyHs256JwtPayload({
      token: signToken({ _id: 'user-1', exp: 100 }),
      getJwtSecret: () => 'unit-jwt-secret',
      nowInSeconds: 100,
    })).toMatchObject({ ok: false, message: 'Authentication token expired.' });
  });

  it('returns a server error for the default missing-secret path', () => {
    const token = signToken({ _id: 'user-1', exp: 200 });

    expect(verifyHs256JwtPayload({ token, nowInSeconds: 100 })).toEqual({
      ok: false,
      status: 500,
      message: 'JWT_SECRET is not configured.',
    });
  });
});
