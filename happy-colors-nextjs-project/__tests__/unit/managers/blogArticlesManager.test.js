import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createBlogArticle,
  deleteBlogArticle,
  editBlogArticle,
  getAdminBlogArticleById,
  getAdminBlogArticles,
  getBlogArticleById,
  getBlogArticles,
  invalidateBlogCaches,
} from '../../../src/managers/blogArticlesManager.js';
import { jsonResponse } from '../../api/_helpers.js';

describe('blogArticlesManager', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('loads public and admin blog article endpoints with the expected options', async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse({ body: [] }))
      .mockResolvedValueOnce(jsonResponse({ body: { _id: 'a'.repeat(24) } }))
      .mockResolvedValueOnce(jsonResponse({ body: [] }))
      .mockResolvedValueOnce(jsonResponse({ body: { _id: 'b'.repeat(24) } }));

    await expect(getBlogArticles()).resolves.toEqual([]);
    await expect(getBlogArticleById('a'.repeat(24))).resolves.toEqual({ _id: 'a'.repeat(24) });
    await expect(getAdminBlogArticles()).resolves.toEqual([]);
    await expect(getAdminBlogArticleById('b'.repeat(24))).resolves.toEqual({ _id: 'b'.repeat(24) });

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3000/api/blog-articles',
      expect.objectContaining({
        next: {
          revalidate: 60,
          tags: ['blog-articles'],
        },
      })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3000/api/blog-articles/aaaaaaaaaaaaaaaaaaaaaaaa',
      expect.objectContaining({ cache: 'no-store' })
    );
    expect(fetch.mock.calls[1][1]).not.toHaveProperty('next');
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      'http://localhost:3000/api/blog-articles/admin',
      expect.objectContaining({ credentials: 'include', cache: 'no-store' })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      4,
      'http://localhost:3000/api/blog-articles/admin/bbbbbbbbbbbbbbbbbbbbbbbb',
      expect.objectContaining({ credentials: 'include', cache: 'no-store' })
    );
  });

  it('threads locale params through public blog reads', async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse({ body: [] }))
      .mockResolvedValueOnce(jsonResponse({ body: { _id: 'a'.repeat(24) } }));

    await expect(getBlogArticles({ locale: 'en' })).resolves.toEqual([]);
    await expect(getBlogArticleById('a'.repeat(24), { locale: 'en' })).resolves.toEqual({
      _id: 'a'.repeat(24),
    });

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3000/api/blog-articles?locale=en',
      expect.objectContaining({
        next: {
          revalidate: 60,
          tags: ['blog-articles'],
        },
      })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3000/api/blog-articles/aaaaaaaaaaaaaaaaaaaaaaaa?locale=en',
      expect.objectContaining({ cache: 'no-store' })
    );
  });

  it('keeps client-side public blog list refreshes uncached', async () => {
    vi.stubGlobal('window', {});
    fetch.mockResolvedValueOnce(jsonResponse({ body: [] }));

    await expect(getBlogArticles()).resolves.toEqual([]);

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/blog-articles',
      expect.objectContaining({ cache: 'no-store' })
    );
    expect(fetch.mock.calls[0][1]).not.toHaveProperty('next');
  });

  it('creates and edits articles while invalidating caches', async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse({ body: { _id: 'article-1' } }))
      .mockResolvedValueOnce(jsonResponse())
      .mockResolvedValueOnce(jsonResponse({ body: { _id: 'article-1' } }))
      .mockResolvedValueOnce(jsonResponse());

    await createBlogArticle({ title: 'Title', status: 'draft', owner: 'ignored' });
    await editBlogArticle('article-1', { title: 'Edited', status: 'published', excerpt: 'ignored' });

    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ title: 'Title' });
    expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual({ title: 'Edited' });
    expect(fetch.mock.calls[1][0]).toBe('/api/revalidate/blog');
    expect(fetch.mock.calls[3][0]).toBe('/api/revalidate/blog');
  });

  it('deletes and logs revalidation failures without failing mutations', async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse({ body: {} }))
      .mockRejectedValueOnce(new Error('revalidate failed'));

    await expect(deleteBlogArticle('article-1')).resolves.toEqual({});

    expect(console.error).toHaveBeenCalled();
    expect(fetch.mock.calls[0][0]).toBe('http://localhost:3000/api/blog-articles/article-1');
    expect(fetch.mock.calls[0][1]).toEqual(
      expect.objectContaining({ method: 'DELETE', credentials: 'include' })
    );
  });

  it('throws meaningful errors on non-ok responses and exposes explicit invalidation helper', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ ok: false, body: { message: 'Not allowed' } }));

    await expect(createBlogArticle({ title: 'Title' })).rejects.toThrow('Not allowed');

    fetch.mockResolvedValueOnce(jsonResponse());

    await expect(invalidateBlogCaches('article-1')).resolves.toBeUndefined();
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/revalidate/blog',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ articleId: 'article-1' }),
      })
    );
  });
});
