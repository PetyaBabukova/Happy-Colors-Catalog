import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function loadTokenHelpers() {
  return import('../../../src/app/api/_lib/uploadDeleteToken.js');
}

describe('uploadDeleteToken', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-29T10:00:00.000Z'));
    vi.stubEnv('UPLOAD_DELETE_TOKEN_SECRET', 'unit-delete-secret');
    vi.stubEnv('JWT_SECRET', '');
    vi.resetModules();
    vi.doMock('../../../src/app/api/_lib/env.js', () => ({
      ensureServerEnvLoaded: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.doUnmock('../../../src/app/api/_lib/env.js');
  });

  it('creates a token that verifies for the same object and user', async () => {
    const { createUploadDeleteToken, verifyUploadDeleteToken } = await loadTokenHelpers();
    const token = createUploadDeleteToken({ objectName: 'products/images/a.webp', userId: 'user-1' });

    expect(verifyUploadDeleteToken({ token, objectName: 'products/images/a.webp', userId: 'user-1' })).toEqual({
      ok: true,
    });
  });

  it('rejects tampered, mismatched, and malformed tokens', async () => {
    const { createUploadDeleteToken, verifyUploadDeleteToken } = await loadTokenHelpers();
    const token = createUploadDeleteToken({ objectName: 'products/images/a.webp', userId: 'user-1' });
    const tamperedToken = `${token.slice(0, -1)}x`;

    expect(verifyUploadDeleteToken({ token: tamperedToken, objectName: 'products/images/a.webp', userId: 'user-1' })).toMatchObject({
      ok: false,
    });
    expect(verifyUploadDeleteToken({ token, objectName: 'products/images/b.webp', userId: 'user-1' })).toMatchObject({
      ok: false,
    });
    expect(verifyUploadDeleteToken({ token: 'not-a-token', objectName: 'products/images/a.webp', userId: 'user-1' })).toMatchObject({
      ok: false,
    });
  });

  it('rejects expired tokens', async () => {
    const { createUploadDeleteToken, verifyUploadDeleteToken } = await loadTokenHelpers();
    const token = createUploadDeleteToken({ objectName: 'products/images/a.webp', userId: 'user-1' });

    vi.advanceTimersByTime(20 * 60 * 1000 + 1);

    expect(verifyUploadDeleteToken({ token, objectName: 'products/images/a.webp', userId: 'user-1' })).toMatchObject({
      ok: false,
      message: expect.stringContaining('expired'),
    });
  });

  it('throws when no signing secret is configured', async () => {
    vi.stubEnv('UPLOAD_DELETE_TOKEN_SECRET', '');
    vi.stubEnv('JWT_SECRET', '');
    vi.resetModules();
    vi.doMock('../../../src/app/api/_lib/env.js', () => ({
      ensureServerEnvLoaded: vi.fn(),
    }));
    const { createUploadDeleteToken } = await loadTokenHelpers();

    expect(() => createUploadDeleteToken({ objectName: 'products/images/a.webp', userId: 'user-1' })).toThrow();
  });
});
