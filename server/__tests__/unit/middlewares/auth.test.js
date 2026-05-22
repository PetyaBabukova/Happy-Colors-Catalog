import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AUTH_COOKIE_NAME,
  getJwtSecret,
  requireActiveArtistOrFullAdmin,
  requireAuth,
  requireFullAdmin,
  signAuthToken,
} from '../../../middlewares/auth.js';
import { buildNext, buildReq, buildRes } from '../_helpers/httpMocks.js';

const { findById } = vi.hoisted(() => ({
  findById: vi.fn(),
}));

vi.mock('../../../models/User.js', () => ({
  default: {
    findById,
  },
}));

function mockUserLookup(user) {
  findById.mockReturnValue({
    lean: vi.fn().mockResolvedValue(user),
  });
}

describe('auth middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  it('throws when JWT_SECRET is not configured', () => {
    expect(() => getJwtSecret()).toThrow();
  });

  it('rejects requests without an auth cookie', async () => {
    const res = buildRes();
    const next = buildNext();

    await requireAuth(buildReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Missing authentication token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('verifies a valid token and attaches the canonical database user', async () => {
    process.env.JWT_SECRET = 'unit-secret';
    mockUserLookup({
      _id: 'user-1',
      username: 'Owner',
      email: 'owner@example.com',
      role: 'full_admin',
    });
    const token = signAuthToken({ _id: 'user-1', role: 'artist' });
    const req = buildReq({ cookies: { [AUTH_COOKIE_NAME]: token } });
    const res = buildRes();
    const next = buildNext();

    await requireAuth(req, res, next);

    expect(findById).toHaveBeenCalledWith('user-1');
    expect(req.user).toMatchObject({
      _id: 'user-1',
      username: 'Owner',
      email: 'owner@example.com',
      role: 'full_admin',
      artistStatus: null,
    });
    expect(next).toHaveBeenCalledOnce();
  });

  it('treats missing stored roles as customer', async () => {
    process.env.JWT_SECRET = 'unit-secret';
    mockUserLookup({
      _id: 'user-2',
      username: 'Petya',
      email: 'petya@example.com',
    });
    const token = signAuthToken({ _id: 'user-2' });
    const req = buildReq({ cookies: { [AUTH_COOKIE_NAME]: token } });
    const res = buildRes();
    const next = buildNext();

    await requireAuth(req, res, next);

    expect(req.user).toMatchObject({ role: 'customer', artistStatus: null });
  });

  it('rejects tokens for missing users', async () => {
    process.env.JWT_SECRET = 'unit-secret';
    mockUserLookup(null);
    const token = signAuthToken({ _id: 'missing-user' });
    const res = buildRes();
    const next = buildNext();

    await requireAuth(buildReq({ cookies: { [AUTH_COOKIE_NAME]: token } }), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('signs tokens that can be verified', () => {
    process.env.JWT_SECRET = 'unit-secret';
    const token = signAuthToken({ _id: 'user-2', email: 'owner@example.com' }, { expiresIn: '1h' });

    expect(jwt.verify(token, process.env.JWT_SECRET)).toMatchObject({
      _id: 'user-2',
      email: 'owner@example.com',
    });
  });

  it('rejects invalid tokens', async () => {
    process.env.JWT_SECRET = 'unit-secret';
    const res = buildRes();
    const next = buildNext();

    await requireAuth(buildReq({ cookies: { [AUTH_COOKIE_NAME]: 'bad-token' } }), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('requires full admin role', () => {
    const allowedRes = buildRes();
    const allowedNext = buildNext();
    const deniedRes = buildRes();
    const deniedNext = buildNext();

    requireFullAdmin(buildReq({ user: { role: 'full_admin' } }), allowedRes, allowedNext);
    requireFullAdmin(buildReq({ user: { role: 'artist' } }), deniedRes, deniedNext);

    expect(allowedNext).toHaveBeenCalledOnce();
    expect(deniedRes.status).toHaveBeenCalledWith(403);
    expect(deniedNext).not.toHaveBeenCalled();
  });

  it('requires a non-suspended artist or full admin', () => {
    const adminNext = buildNext();
    const artistNext = buildNext();
    const pendingNext = buildNext();
    const pendingRes = buildRes();
    const suspendedNext = buildNext();
    const suspendedRes = buildRes();

    requireActiveArtistOrFullAdmin(buildReq({ user: { role: 'full_admin' } }), buildRes(), adminNext);
    requireActiveArtistOrFullAdmin(
      buildReq({ user: { role: 'artist', artistStatus: 'active' } }),
      buildRes(),
      artistNext
    );
    requireActiveArtistOrFullAdmin(
      buildReq({ user: { role: 'artist', artistStatus: 'pending' } }),
      pendingRes,
      pendingNext
    );
    requireActiveArtistOrFullAdmin(
      buildReq({ user: { role: 'artist', artistStatus: 'suspended' } }),
      suspendedRes,
      suspendedNext
    );

    expect(adminNext).toHaveBeenCalledOnce();
    expect(artistNext).toHaveBeenCalledOnce();
    expect(pendingNext).toHaveBeenCalledOnce();
    expect(suspendedRes.status).toHaveBeenCalledWith(403);
    expect(suspendedNext).not.toHaveBeenCalled();
  });
});
