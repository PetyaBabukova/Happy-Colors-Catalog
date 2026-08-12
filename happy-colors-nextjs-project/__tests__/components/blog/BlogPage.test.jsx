import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  beforeEach(() => {
    vi.stubEnv('RENDER_GIT_BRANCH', 'main');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://happycolors.eu/');
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
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

  it('renders the cached article list without fetching uncached detail data', async () => {
    getBlogArticles.mockResolvedValue([
      {
        _id: 'article-1',
        title: 'Latest article',
        contentHtml: '<p>Full article body.</p>',
        heroImageUrl: 'https://cdn.example.com/article-hero.webp',
        thumbnailImageUrl: 'https://cdn.example.com/article.webp',
        heroImageAlt: 'Article image',
        publishedAt: '2026-05-15T08:00:00.000Z',
      },
      {
        _id: 'article-2',
        title: 'Older article',
        excerpt: 'Older summary.',
      },
    ]);

    const element = await BlogPage({ params: Promise.resolve({ locale: 'en' }) });

    render(element, { locale: 'en' });

    expect(getBlogArticles).toHaveBeenCalledWith({ locale: 'en' });
    expect(getBlogArticle).not.toHaveBeenCalled();
    expect(screen.getByTestId('blog-article-details')).toHaveAttribute('data-article-id', 'article-1');
    expect(screen.getByTestId('blog-article-details')).toHaveAttribute('data-count', '2');
  });

  it('shows a load state instead of a false empty state when the localized list payload is unusable', async () => {
    getBlogArticles.mockResolvedValue([{ title: 'Missing id article' }]);

    const element = await BlogPage({ params: Promise.resolve({ locale: 'en' }) });

    render(element, { locale: 'en' });

    expect(getBlogArticles).toHaveBeenCalledWith({ locale: 'en' });
    expect(getBlogArticle).not.toHaveBeenCalled();
    expect(screen.getByText('The latest blog article cannot be shown at the moment.')).toBeInTheDocument();
    expect(screen.queryByText('There are no published blog articles yet.')).not.toBeInTheDocument();
  });

  it('keeps showing articles when the latest list item only has summary fields', async () => {
    getBlogArticles.mockResolvedValue([
      {
        _id: 'article-1',
        title: 'Latest article',
        excerpt: 'Summary text.',
        thumbnailImageUrl: 'https://cdn.example.com/article.webp',
      },
    ]);

    const element = await BlogPage({ params: Promise.resolve({ locale: 'en' }) });

    render(element, { locale: 'en' });

    expect(getBlogArticle).not.toHaveBeenCalled();
    expect(screen.getByTestId('blog-article-details')).toHaveAttribute('data-article-id', 'article-1');
    expect(screen.queryByText('The latest blog article cannot be shown at the moment.')).not.toBeInTheDocument();
  });
});
