import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getNewsletterSubscribeToken,
  subscribeToNewsletter,
  unsubscribeFromNewsletter,
} from '../../../src/managers/newsletterManager.js';

function jsonResponse({ ok = true, body = {} } = {}) {
  return {
    ok,
    json: vi.fn().mockResolvedValue(body),
  };
}

describe('newsletterManager', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('fetches newsletter subscribe tokens', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ body: { token: 'token-1' } }));

    await expect(getNewsletterSubscribeToken()).resolves.toEqual({ token: 'token-1' });

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/newsletter/subscribe-token',
      expect.objectContaining({
        credentials: 'include',
      })
    );
  });

  it('posts newsletter subscribe payloads and returns parsed responses', async () => {
    const payload = {
      email: 'petya@example.com',
      consent: true,
      website: '',
      formToken: 'token-1',
    };
    fetch.mockResolvedValueOnce(jsonResponse({ body: { message: 'subscribed' } }));

    await expect(subscribeToNewsletter(payload)).resolves.toEqual({ message: 'subscribed' });

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/newsletter/subscribe',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    );
  });

  it('posts unsubscribe tokens and returns parsed responses', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ body: { message: 'unsubscribed' } }));

    await expect(unsubscribeFromNewsletter('token-1')).resolves.toEqual({
      message: 'unsubscribed',
    });

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/newsletter/unsubscribe',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'token-1' }),
      })
    );
  });

  it('surfaces backend errors and falls back when the body is empty', async () => {
    fetch.mockResolvedValueOnce(
      jsonResponse({ ok: false, body: { message: 'Too many requests', code: 'rate_limited' } })
    );

    let error;

    try {
      await subscribeToNewsletter({ email: 'petya@example.com' });
    } catch (caughtError) {
      error = caughtError;
    }

    expect(error.message).toBe('Too many requests');
    expect(error.code).toBe('rate_limited');

    fetch.mockResolvedValueOnce(jsonResponse({ ok: false, body: null }));

    await expect(unsubscribeFromNewsletter('token-1')).rejects.toThrow('Не успяхме да ви отпишем.');
  });
});
