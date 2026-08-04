import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '../test-utils.jsx';

vi.hoisted(() => {
  vi.stubEnv('RENDER_GIT_BRANCH', 'main');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://happycolors.eu/');
});

import BlogPage, { generateMetadata } from '@/app/blog/page';
import { generateMetadata as generateLocalizedMetadata } from '@/app/(localized)/[locale]/blog/page';
import { getBlogArticle } from '@/lib/getBlogArticle';
import { getBlogArticles } from '@/managers/blogArticlesManager';

vi.mock('@/components/blog/BlogArticleDetails', () => ({
  default: ({ article, articles }) => (
    <article data-testid="blog-article-details" data-article-id={article._id} data-count={articles.length} />
  ),
}));

vi.mock('@/lib/getBlogArticle', () => ({
  getBlogArticle: vi.fn(),
}));

vi.mock('@/managers/blogArticlesManager', () => ({
  getBlogArticles: vi.fn(),
}));

describe('BlogPage', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('generates English metadata for localized blog routes', async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ locale: 'en' }) });

    expect(metadata.title).toBe('Blog');
    expect(metadata.description).toMatch(/Ideas, stories, and inspiration/);
    expect(metadata.alternates.canonical).toBe('/en/blog');
  });

  it('re-exports metadata generation from the localized blog wrapper', async () => {
    const metadata = await generateLocalizedMetadata({ params: Promise.resolve({ locale: 'en' }) });

    expect(metadata.title).toBe('Blog');
    expect(metadata.alternates.canonical).toBe('/en/blog');
  });

  it('renders the English empty state while threading locale to backend calls', async () => {
    getBlogArticles.mockResolvedValue([]);

    const element = await BlogPage({ params: Promise.resolve({ locale: 'en' }) });

    render(element, { locale: 'en' });

    expect(getBlogArticles).toHaveBeenCalledWith({ locale: 'en' });
    expect(getBlogArticle).not.toHaveBeenCalled();
    expect(screen.getByText('There are no published blog articles yet.')).toBeInTheDocument();
  });

  it('loads the latest article while threading locale to backend calls', async () => {
    getBlogArticles.mockResolvedValue([{ _id: 'article-1' }, { _id: 'article-2' }]);
    getBlogArticle.mockResolvedValue({ _id: 'article-1', title: 'Latest article' });

    const element = await BlogPage({ params: Promise.resolve({ locale: 'en' }) });

    render(element, { locale: 'en' });

    expect(getBlogArticles).toHaveBeenCalledWith({ locale: 'en' });
    expect(getBlogArticle).toHaveBeenCalledWith('article-1', { locale: 'en' });
    expect(screen.getByTestId('blog-article-details')).toHaveAttribute('data-article-id', 'article-1');
    expect(screen.getByTestId('blog-article-details')).toHaveAttribute('data-count', '2');
  });
});
