import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getBlogNewsletterPrefill,
  getNewsletterSendStatus,
  getProductNewsletterPrefill,
  sendNewsletterTest,
  sendNewsletterToSubscribers,
} from '../../../src/managers/newsletterSendManager.js';

function jsonResponse({ ok = true, body = {} } = {}) {
  return {
    ok,
    json: vi.fn().mockResolvedValue(body),
  };
}

const payload = {
  subject: 'News',
  contentHtml: '<p>Hello</p>',
  contentJson: { type: 'doc', content: [{ type: 'paragraph' }] },
  contentText: 'Hello',
  sourceType: 'custom',
  imageUrl: 'https://evil.example/image.png',
  ctaUrl: 'https://evil.example',
};

describe('newsletterSendManager', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('gets authenticated newsletter send status', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ body: { activeSubscribers: 7 } }));

    await expect(getNewsletterSendStatus()).resolves.toEqual({ activeSubscribers: 7 });

    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/api/newsletter/send/status', {
      credentials: 'include',
      cache: 'no-store',
    });
  });

  it('posts test send payloads without client-controlled CTA or image data', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ body: { message: 'ok', recipients: 2 } }));

    await expect(sendNewsletterTest(payload)).resolves.toEqual({ message: 'ok', recipients: 2 });

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/newsletter/send/test',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          subject: 'News',
          contentHtml: '<p>Hello</p>',
          contentJson: { type: 'doc', content: [{ type: 'paragraph' }] },
          contentText: 'Hello',
          sourceType: 'custom',
        }),
      })
    );
  });

  it('posts broadcast payloads and returns aggregate counts only', async () => {
    fetch.mockResolvedValueOnce(
      jsonResponse({ body: { message: 'done', sent: 3, failed: 0, activeSubscribers: 3 } })
    );

    await expect(sendNewsletterToSubscribers(payload)).resolves.toEqual({
      message: 'done',
      sent: 3,
      failed: 0,
      activeSubscribers: 3,
    });

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/newsletter/send',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      })
    );
  });

  it('drops login-shaped fields from broadcast payloads', async () => {
    fetch.mockResolvedValueOnce(
      jsonResponse({ body: { message: 'done', sent: 1, failed: 0, activeSubscribers: 1 } })
    );

    await sendNewsletterToSubscribers({
      ...payload,
      email: 'owner@example.com',
      password: 'real-password-should-not-be-sent',
    });

    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      subject: 'News',
      contentHtml: '<p>Hello</p>',
      contentJson: { type: 'doc', content: [{ type: 'paragraph' }] },
      contentText: 'Hello',
      sourceType: 'custom',
    });
  });

  it('gets product prefill with credentials', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ body: { sourceType: 'product', sourceId: 'product-1' } }));

    await expect(getProductNewsletterPrefill('product-1')).resolves.toEqual({
      sourceType: 'product',
      sourceId: 'product-1',
    });

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/newsletter/send/prefill/product/product-1',
      {
        credentials: 'include',
        cache: 'no-store',
      }
    );
  });

  it('gets blog prefill with credentials', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ body: { sourceType: 'blog', sourceId: 'article-1' } }));

    await expect(getBlogNewsletterPrefill('article-1')).resolves.toEqual({
      sourceType: 'blog',
      sourceId: 'article-1',
    });

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/newsletter/send/prefill/blog/article-1',
      {
        credentials: 'include',
        cache: 'no-store',
      }
    );
  });

  it('keeps product source ids while still dropping client-controlled CTA and image data', async () => {
    fetch.mockResolvedValueOnce(
      jsonResponse({ body: { message: 'done', sent: 1, failed: 0, activeSubscribers: 1 } })
    );

    await sendNewsletterToSubscribers({
      ...payload,
      sourceType: 'product',
      sourceId: 'product-1',
    });

    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      subject: 'News',
      contentHtml: '<p>Hello</p>',
      contentJson: { type: 'doc', content: [{ type: 'paragraph' }] },
      contentText: 'Hello',
      sourceType: 'product',
      sourceId: 'product-1',
    });
  });

  it('keeps blog source ids while still dropping client-controlled CTA and image data', async () => {
    fetch.mockResolvedValueOnce(
      jsonResponse({ body: { message: 'done', sent: 1, failed: 0, activeSubscribers: 1 } })
    );

    await sendNewsletterToSubscribers({
      ...payload,
      sourceType: 'blog',
      sourceId: 'article-1',
    });

    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      subject: 'News',
      contentHtml: '<p>Hello</p>',
      contentJson: { type: 'doc', content: [{ type: 'paragraph' }] },
      contentText: 'Hello',
      sourceType: 'blog',
      sourceId: 'article-1',
    });
  });

  it('surfaces backend errors', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ ok: false, body: { message: 'Nope' } }));

    await expect(sendNewsletterTest(payload)).rejects.toThrow('Nope');
  });
});
