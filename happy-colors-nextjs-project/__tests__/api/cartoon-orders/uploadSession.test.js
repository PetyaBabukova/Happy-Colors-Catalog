import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readJson } from '../_helpers.js';
import {
  CARTOON_ORDER_UPLOAD_SESSION_PURPOSE,
  verifyCartoonOrderUploadToken,
} from '../../../src/app/api/_lib/cartoonOrderUploadToken.js';
import { resetCartoonUploadRateLimitsForTests } from '../../../src/app/api/_lib/cartoonOrderUploadSecurity.js';

const createCartoonUploadSession = vi.fn();

function createPostRequest({
  origin = 'https://happycolors.test',
  host = 'happycolors.test',
  forwardedFor = '203.0.113.10',
  realIp = '',
} = {}) {
  const headers = new Map([
    ['origin', origin],
    ['host', host],
    ['x-forwarded-proto', 'https'],
    ['x-forwarded-for', forwardedFor],
  ]);

  if (realIp) {
    headers.set('x-real-ip', realIp);
  }

  return {
    headers: {
      get: (name) => headers.get(String(name).toLowerCase()) || null,
    },
  };
}

async function loadRoute() {
  return import('../../../src/app/api/cartoon-orders/upload-session/route.js');
}

describe('/api/cartoon-orders/upload-session', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('CARTOON_ORDER_UPLOAD_TOKEN_SECRET', 'test-cartoon-upload-secret');
    vi.stubEnv('NEXT_PUBLIC_CARTOONS_SERVICE_ENABLED', 'true');
    vi.stubEnv('CARTOON_PERSISTENT_ABUSE_GUARDS_ENABLED', 'false');
    resetCartoonUploadRateLimitsForTests();

    createCartoonUploadSession.mockResolvedValue({
      sessionId: 'session-1',
      createdAt: new Date('2026-06-05T10:00:00Z'),
      expiresAt: new Date(Date.now() + 20 * 60 * 1000),
      uploadCount: 0,
      uploadedObjects: [],
    });

    vi.doMock('../../../src/app/api/_lib/cartoonUploadSessionStore.js', () => ({
      createCartoonUploadSession,
    }));
  });

  it('creates a persisted upload session and returns no-store token metadata', async () => {
    const { POST } = await loadRoute();

    const response = await POST(createPostRequest());
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(body).toMatchObject({
      sessionId: 'session-1',
      maxFiles: 5,
      maxSizeBytes: 3 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    });
    expect(createCartoonUploadSession).toHaveBeenCalledTimes(1);
    expect(
      verifyCartoonOrderUploadToken({
        token: body.uploadSessionToken,
        purpose: CARTOON_ORDER_UPLOAD_SESSION_PURPOSE,
        sessionId: 'session-1',
      })
    ).toMatchObject({ ok: true });
  });

  it('sets the browser guard cookie on session creation only when persistent guards are enabled', async () => {
    vi.stubEnv('CARTOON_PERSISTENT_ABUSE_GUARDS_ENABLED', 'true');
    const { POST } = await loadRoute();

    const response = await POST(createPostRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('hc_cartoon_guard=');
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(response.headers.get('set-cookie')).toContain('SameSite=lax');
  });

  it('does not expose upload sessions while the cartoons service gate is disabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_CARTOONS_SERVICE_ENABLED', 'false');
    const { POST } = await loadRoute();

    const response = await POST(createPostRequest());

    expect(response.status).toBe(404);
    expect(createCartoonUploadSession).not.toHaveBeenCalled();
  });

  it('rejects cross-origin session creation requests', async () => {
    const { POST } = await loadRoute();

    const response = await POST(createPostRequest({ origin: 'https://evil.test' }));

    expect(response.status).toBe(403);
    expect(createCartoonUploadSession).not.toHaveBeenCalled();
  });

  it('does not trust the request Host as an allowed production origin', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://happycolors.test');
    const { POST } = await loadRoute();

    const response = await POST(
      createPostRequest({
        origin: 'https://evil.test',
        host: 'evil.test',
      })
    );

    expect(response.status).toBe(403);
    expect(createCartoonUploadSession).not.toHaveBeenCalled();
  });

  it('rate limits repeated upload session creation attempts', async () => {
    const { POST } = await loadRoute();
    let response;

    for (let index = 0; index < 21; index += 1) {
      response = await POST(createPostRequest());
    }

    expect(response.status).toBe(429);
  });

  it('keys rate limiting by the proxy-provided real IP instead of spoofable forwarded values', async () => {
    const { POST } = await loadRoute();
    let response;

    for (let index = 0; index < 21; index += 1) {
      response = await POST(
        createPostRequest({
          forwardedFor: `198.51.100.${index}, 203.0.113.20`,
          realIp: '203.0.113.30',
        })
      );
    }

    expect(response.status).toBe(429);
  });
});
