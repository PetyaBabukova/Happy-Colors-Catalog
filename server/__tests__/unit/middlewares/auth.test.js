import jwt from 'jsonwebtoken';
import { afterEach, describe, expect, it } from 'vitest';
import {
  AUTH_COOKIE_NAME,
  getJwtSecret,
  requireAuth,
  signAuthToken,
} from '../../../middlewares/auth.js';
import { buildNext, buildReq, buildRes } from '../_helpers/httpMocks.js';

describe('auth middleware', () => {
  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  it('throws when JWT_SECRET is not configured', () => {
    expect(() => getJwtSecret()).toThrow();
  });

  it('rejects requests without an auth cookie', () => {
    const res = buildRes();
    const next = buildNext();

    requireAuth(buildReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Missing authentication token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('verifies a valid token and attaches the decoded user', () => {
    process.env.JWT_SECRET = 'unit-secret';
    const token = signAuthToken({ _id: 'user-1', role: 'owner' });
    const req = buildReq({ cookies: { [AUTH_COOKIE_NAME]: token } });
    const res = buildRes();
    const next = buildNext();

    requireAuth(req, res, next);

    expect(req.user).toMatchObject({ _id: 'user-1', role: 'owner' });
    expect(next).toHaveBeenCalledOnce();
  });

  it('signs tokens that the auth middleware can verify', () => {
    process.env.JWT_SECRET = 'unit-secret';
    const token = signAuthToken({ _id: 'user-2', email: 'owner@example.com' }, { expiresIn: '1h' });

    expect(jwt.verify(token, process.env.JWT_SECRET)).toMatchObject({
      _id: 'user-2',
      email: 'owner@example.com',
    });
  });

  it('rejects invalid tokens', () => {
    process.env.JWT_SECRET = 'unit-secret';
    const res = buildRes();
    const next = buildNext();

    requireAuth(buildReq({ cookies: { [AUTH_COOKIE_NAME]: 'bad-token' } }), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });
});
