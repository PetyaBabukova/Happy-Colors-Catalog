import { beforeEach, describe, expect, it, vi } from 'vitest';

const getBlogArticleMock = vi.hoisted(() => vi.fn());
const getBlogArticlesMock = vi.hoisted(() => vi.fn());
const buildBlogArticleJsonLdMock = vi.hoisted(() => vi.fn(() => ({ '@type': 'BlogPosting' })));
const buildBlogArticleBreadcrumbJsonLdMock = vi.hoisted(() => vi.fn(() => ({ '@type': 'BreadcrumbList' })));
const buildBlogMetadataMock = vi.hoisted(() => vi.fn(() => ({ title: 'Blog metadata' })));
const shouldRenderBlogArticleJsonLdMock = vi.hoisted(() => vi.fn(() => true));

vi.mock('@/lib/getBlogArticle', () => ({
  getBlogArticle: getBlogArticleMock,
}));

vi.mock('@/managers/blogArticlesManager', () => ({
  getBlogArticles: getBlogArticlesMock,
}));

vi.mock('@/components/blog/BlogArticleDetails', () => ({
  default: vi.fn(() => <article data-testid="blog-article-details" />),
}));

vi.mock('@/utils/blogSeo', () => ({
  buildBlogArticleBreadcrumbJsonLd: buildBlogArticleBreadcrumbJsonLdMock,
  buildBlogArticleJsonLd: buildBlogArticleJsonLdMock,
  buildBlogMetadata: buildBlogMetadataMock,
  shouldRenderBlogArticleJsonLd: shouldRenderBlogArticleJsonLdMock,
  stringifyJsonLd: vi.fn(() => '{}'),
}));

describe('BlogArticlePage locale wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getBlogArticleMock.mockResolvedValue({ _id: 'article-1', title: 'English story' });
    getBlogArticlesMock.mockResolvedValue([]);
    shouldRenderBlogArticleJsonLdMock.mockReturnValue(true);
  });

  it('threads locale through article fetches and SEO helpers', async () => {
    const { default: BlogArticlePage, generateMetadata } = await import('@/app/blog/[articleId]/page');

    await expect(
      generateMetadata({ params: Promise.resolve({ articleId: 'article-1', locale: 'en' }) })
    ).resolves.toEqual({ title: 'Blog metadata' });

    expect(getBlogArticleMock).toHaveBeenCalledWith('article-1', { locale: 'en' });
    expect(buildBlogMetadataMock).toHaveBeenCalledWith(
      { _id: 'article-1', title: 'English story' },
      'article-1',
      'en'
    );

    getBlogArticleMock.mockClear();

    await BlogArticlePage({
      params: Promise.resolve({ articleId: 'article-1', locale: 'en' }),
    });

    expect(getBlogArticleMock).toHaveBeenCalledWith('article-1', { locale: 'en' });
    expect(getBlogArticlesMock).toHaveBeenCalledWith({ locale: 'en' });
    expect(buildBlogArticleJsonLdMock).toHaveBeenCalledWith(
      { _id: 'article-1', title: 'English story' },
      'article-1',
      'en'
    );
    expect(buildBlogArticleBreadcrumbJsonLdMock).toHaveBeenCalledWith(
      { _id: 'article-1', title: 'English story' },
      'article-1',
      'en'
    );
  });

  it('omits BlogPosting JSON-LD for English fallback article content', async () => {
    const fallbackArticle = {
      _id: 'article-1',
      title: 'Source story',
      contentLocale: 'bg',
      translationPending: true,
    };
    getBlogArticleMock.mockResolvedValue(fallbackArticle);
    shouldRenderBlogArticleJsonLdMock.mockReturnValue(false);
    const { default: BlogArticlePage } = await import('@/app/blog/[articleId]/page');

    await BlogArticlePage({
      params: Promise.resolve({ articleId: 'article-1', locale: 'en' }),
    });

    expect(shouldRenderBlogArticleJsonLdMock).toHaveBeenCalledWith(fallbackArticle, 'en');
    expect(buildBlogArticleJsonLdMock).not.toHaveBeenCalled();
    expect(buildBlogArticleBreadcrumbJsonLdMock).not.toHaveBeenCalled();
  });

  it('generates localized noindex metadata when an English blog article is missing', async () => {
    getBlogArticleMock.mockResolvedValue(null);
    const { generateMetadata } = await import('@/app/blog/[articleId]/page');

    await expect(
      generateMetadata({ params: Promise.resolve({ articleId: 'missing', locale: 'en' }) })
    ).resolves.toEqual({
      title: 'Blog article not found',
      description: 'Try again or choose another blog article.',
      robots: {
        index: false,
        follow: false,
      },
    });
  });
});
