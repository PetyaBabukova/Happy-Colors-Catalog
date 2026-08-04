import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/managers/blogArticlesManager.js', () => ({
  getBlogArticleById: vi.fn(),
}));

let getBlogArticleById;
let getBlogArticle;

describe('getBlogArticle', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    ({ getBlogArticleById } = await import('../../../src/managers/blogArticlesManager.js'));
    ({ getBlogArticle } = await import('../../../src/lib/getBlogArticle.js'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('loads public blog articles through the backend manager', async () => {
    getBlogArticleById.mockResolvedValueOnce({ _id: 'article-1', title: 'English title' });

    await expect(getBlogArticle('article-1')).resolves.toEqual({
      _id: 'article-1',
      title: 'English title',
    });

    expect(getBlogArticleById).toHaveBeenCalledWith('article-1', { locale: undefined });
  });

  it('threads route locale to the backend manager', async () => {
    getBlogArticleById.mockResolvedValueOnce({ _id: 'article-1', title: 'English title' });

    await expect(getBlogArticle('article-1', { locale: 'en' })).resolves.toEqual({
      _id: 'article-1',
      title: 'English title',
    });

    expect(getBlogArticleById).toHaveBeenCalledWith('article-1', { locale: 'en' });
  });

  it('threads Bulgarian and English article locales to the backend manager', async () => {
    getBlogArticleById
      .mockResolvedValueOnce({ _id: 'article-1', contentLocale: 'bg' })
      .mockResolvedValueOnce({ _id: 'article-1', contentLocale: 'en' });

    await expect(getBlogArticle('article-1', { locale: 'bg' })).resolves.toEqual({
      _id: 'article-1',
      contentLocale: 'bg',
    });
    await expect(getBlogArticle('article-1', { locale: 'en' })).resolves.toEqual({
      _id: 'article-1',
      contentLocale: 'en',
    });

    expect(getBlogArticleById).toHaveBeenNthCalledWith(1, 'article-1', { locale: 'bg' });
    expect(getBlogArticleById).toHaveBeenNthCalledWith(2, 'article-1', { locale: 'en' });
  });

  it('returns null for invalid manager payloads', async () => {
    getBlogArticleById.mockResolvedValueOnce(null);

    await expect(getBlogArticle('missing')).resolves.toBeNull();
  });
});
