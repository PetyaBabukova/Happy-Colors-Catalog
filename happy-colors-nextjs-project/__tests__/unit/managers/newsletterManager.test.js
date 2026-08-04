import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  confirmNewsletterSubscription,
  exchangeNewsletterPreferencesToken,
  getNewsletterSubscribeToken,
  subscribeToNewsletter,
  unsubscribeFromNewsletter,
  updateNewsletterPreferences,
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

  it('posts newsletter confirmation tokens and returns parsed responses', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ body: { message: 'confirmed' } }));

    await expect(confirmNewsletterSubscription('token-1')).resolves.toEqual({ message: 'confirmed' });

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/newsletter/confirm',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'token-1' }),
      })
    );
  });

  it('exchanges newsletter preferences tokens and returns parsed responses', async () => {
    fetch.mockResolvedValueOnce(
      jsonResponse({ body: { sessionToken: 'session-1', currentLocale: 'bg', supportedLocales: ['bg', 'en'] } })
    );

    await expect(exchangeNewsletterPreferencesToken('token-1')).resolves.toEqual({
      sessionToken: 'session-1',
      currentLocale: 'bg',
      supportedLocales: ['bg', 'en'],
    });

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/newsletter/preferences/exchange',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'token-1' }),
      })
    );
  });

  it('posts newsletter preferences updates and returns parsed responses', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ body: { message: 'saved', currentLocale: 'en' } }));

    await expect(
      updateNewsletterPreferences({ sessionToken: 'session-1', locale: 'en' })
    ).resolves.toEqual({ message: 'saved', currentLocale: 'en' });

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/newsletter/preferences',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken: 'session-1', locale: 'en' }),
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
