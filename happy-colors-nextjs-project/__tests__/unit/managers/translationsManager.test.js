import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  acceptCurrentTranslation,
  approveTranslationDraft,
  generateTranslation,
  getTranslationQueue,
  rejectTranslationDraft,
  saveManualTranslation,
} from '@/managers/translationsManager';

function jsonResponse({ ok = true, body = {} } = {}) {
  return {
    ok,
    json: vi.fn().mockResolvedValue(body),
  };
}

describe('translationsManager', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('loads the translation queue with no-store credentials', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ body: { items: [], unresolvedCount: 0 } }));

    await expect(getTranslationQueue({ locale: 'en' })).resolves.toEqual({
      items: [],
      unresolvedCount: 0,
    });

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/translations/queue?locale=en',
      expect.objectContaining({ credentials: 'include', cache: 'no-store' })
    );
  });

  it('sends manual translation payloads as JSON', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ body: { status: 'current' } }));

    await expect(
      saveManualTranslation({
        entityType: 'product',
        entityId: 'product-1',
        locale: 'en',
        expectedSourceRevision: 2,
        expectedTranslationRevision: 0,
        fields: { title: 'English title', description: 'English description' },
      })
    ).resolves.toEqual({ status: 'current' });

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/translations/product/product-1/en',
      expect.objectContaining({
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedSourceRevision: 2,
          expectedTranslationRevision: 0,
          fields: { title: 'English title', description: 'English description' },
        }),
      })
    );
  });

  it('sends generate, decision, and draft actions to their dedicated endpoints', async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse({ body: { status: 'current' } }))
      .mockResolvedValueOnce(jsonResponse({ body: { status: 'current' } }))
      .mockResolvedValueOnce(jsonResponse({ body: { status: 'current' } }))
      .mockResolvedValueOnce(jsonResponse({ body: { status: 'missing' } }));

    await generateTranslation({
      entityType: 'product',
      entityId: 'product-1',
      locale: 'en',
      expectedSourceRevision: 3,
      expectedTranslationRevision: 1,
    });
    await acceptCurrentTranslation({
      entityType: 'product',
      entityId: 'product-1',
      locale: 'en',
      expectedSourceRevision: 3,
      expectedTranslationRevision: 1,
    });
    await approveTranslationDraft({
      entityType: 'blogArticle',
      entityId: 'article-1',
      locale: 'en',
      expectedSourceRevision: 2,
      expectedDraftRevision: 1,
    });
    await rejectTranslationDraft({
      entityType: 'homeBanner',
      entityId: 'banner-1',
      locale: 'en',
      expectedSourceRevision: 2,
      expectedDraftRevision: 1,
    });

    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      'http://localhost:3000/api/translations/product/product-1/en/generate',
      'http://localhost:3000/api/translations/product/product-1/en/accept-current',
      'http://localhost:3000/api/translations/blogArticle/article-1/en/draft/approve',
      'http://localhost:3000/api/translations/homeBanner/banner-1/en/draft/reject',
    ]);
  });

  it('throws server messages for failed responses', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ ok: false, body: { message: 'Conflict' } }));

    await expect(getTranslationQueue({ locale: 'fr' })).rejects.toThrow('Conflict');
  });
});
