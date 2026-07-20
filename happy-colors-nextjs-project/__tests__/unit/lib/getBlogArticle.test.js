import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/managers/blogArticlesManager.js', () => ({
  getBlogArticleById: vi.fn(),
}));

const { getBlogArticleById } = await import('../../../src/managers/blogArticlesManager.js');
const { getBlogArticle } = await import('../../../src/lib/getBlogArticle.js');

describe('getBlogArticle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
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

  it('returns null for invalid manager payloads', async () => {
    getBlogArticleById.mockResolvedValueOnce(null);

    await expect(getBlogArticle('missing')).resolves.toBeNull();
  });
});
