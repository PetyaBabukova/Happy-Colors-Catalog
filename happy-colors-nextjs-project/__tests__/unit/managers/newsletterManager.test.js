import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
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

  it('posts newsletter subscribe payloads and returns parsed responses', async () => {
    const payload = { email: 'petya@example.com', consent: true, website: '' };
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
    fetch.mockResolvedValueOnce(jsonResponse({ ok: false, body: { message: 'Too many requests' } }));

    await expect(subscribeToNewsletter({ email: 'petya@example.com' })).rejects.toThrow(
      'Too many requests'
    );

    fetch.mockResolvedValueOnce(jsonResponse({ ok: false, body: null }));

    await expect(unsubscribeFromNewsletter('token-1')).rejects.toThrow('Не успяхме да ви отпишем.');
  });
});
