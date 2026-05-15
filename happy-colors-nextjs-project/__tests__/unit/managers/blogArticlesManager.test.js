import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  archiveBlogArticle,
  createBlogArticle,
  editBlogArticle,
  getAdminBlogArticleById,
  getAdminBlogArticles,
  getBlogArticleById,
  getBlogArticles,
  invalidateBlogCaches,
  restoreBlogArticle,
} from '../../../src/managers/blogArticlesManager.js';

function jsonResponse({ ok = true, body = {} } = {}) {
  return {
    ok,
    json: vi.fn().mockResolvedValue(body),
  };
}

describe('blogArticlesManager', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.spyOn(console, 'error').mockImplementation(() => {});
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
      expect.objectContaining({ next: { revalidate: 60, tags: ['blog-articles'] } })
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3000/api/blog-articles/aaaaaaaaaaaaaaaaaaaaaaaa',
      expect.objectContaining({ next: { revalidate: 60, tags: ['blog-articles'] } })
    );
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

  it('archives, restores, and logs revalidation failures without failing mutations', async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse({ body: { _id: 'article-1' } }))
      .mockRejectedValueOnce(new Error('revalidate failed'))
      .mockResolvedValueOnce(jsonResponse({ body: { _id: 'article-1' } }))
      .mockResolvedValueOnce(jsonResponse());

    await expect(archiveBlogArticle('article-1')).resolves.toEqual({ _id: 'article-1' });
    await expect(restoreBlogArticle('article-1')).resolves.toEqual({ _id: 'article-1' });

    expect(console.error).toHaveBeenCalled();
    expect(fetch.mock.calls[0][0]).toBe('http://localhost:3000/api/blog-articles/article-1/archive');
    expect(fetch.mock.calls[2][0]).toBe('http://localhost:3000/api/blog-articles/article-1/restore');
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
