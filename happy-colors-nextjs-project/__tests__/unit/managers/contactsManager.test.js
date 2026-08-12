import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendContactForm } from '../../../src/managers/contactsManager.js';
import { jsonResponse } from '../../api/_helpers.js';

describe('contactsManager', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('posts contact form data and returns the parsed response', async () => {
    const payload = {
      name: 'Petya',
      email: 'petya@example.com',
      message: 'I like this candle.',
      productId: 'product-1',
    };
    fetch.mockResolvedValueOnce(jsonResponse({ body: { message: 'sent' } }));

    await expect(sendContactForm(payload)).resolves.toEqual({ message: 'sent' });

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/contacts',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    );
  });

  it('surfaces backend contact errors', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ ok: false, body: { message: 'Invalid email' } }));

    await expect(sendContactForm({ email: 'bad' })).rejects.toMatchObject({
      message: 'Invalid email',
      status: 400,
    });
  });

  it('uses a fallback error when the backend body is empty', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ ok: false, body: null }));

    await expect(sendContactForm({ email: 'bad' })).rejects.toThrow();
  });
});
