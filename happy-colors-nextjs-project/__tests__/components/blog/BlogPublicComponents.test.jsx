import { afterEach, describe, expect, it, vi } from 'vitest';
import BlogArticleDetails from '@/components/blog/BlogArticleDetails';
import { render, screen } from '../test-utils.jsx';

const article = {
  _id: 'a'.repeat(24),
  title: 'Colorful article',
  excerpt: 'Short description.',
  contentHtml: '<p>Useful text</p><ul><li>Tip</li></ul>',
  thumbnailImageUrl: 'https://storage.googleapis.com/test-bucket/blog/articles/thumbnails/article.webp',
  heroImageUrl: 'https://storage.googleapis.com/test-bucket/blog/articles/hero/article.webp',
  heroImageAlt: 'Colorful photo',
  publishedAt: '2026-05-15T08:00:00.000Z',
};

const olderArticle = {
  ...article,
  _id: 'b'.repeat(24),
  title: 'Older article',
  thumbnailImageUrl: 'https://storage.googleapis.com/test-bucket/blog/articles/thumbnails/older.webp',
};

describe('public blog components', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders article detail content and the original hero image without the blog back link', () => {
    render(<BlogArticleDetails article={article} />);

    expect(screen.queryByRole('link', { name: 'Back to blog' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Colorful article' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Colorful photo' })).toHaveAttribute(
      'src',
      article.heroImageUrl
    );
    expect(screen.getByText('Useful text')).toBeInTheDocument();
    expect(screen.getByText('Tip')).toBeInTheDocument();
  });

  it('renders an aside list and marks the selected article', () => {
    render(<BlogArticleDetails article={article} articles={[article, olderArticle]} />);

    expect(screen.getByRole('complementary')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Colorful article/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /Older article/ })).toHaveAttribute(
      'href',
      `/blog/${olderArticle._id}`
    );
    expect(screen.getByRole('img', { name: 'Colorful photo' })).toHaveAttribute(
      'src',
      article.heroImageUrl
    );
    expect(screen.getAllByText('15.05.2026')).toHaveLength(3);
    expect(document.querySelector(`img[src="${olderArticle.thumbnailImageUrl}"]`)).toBeInTheDocument();
  });

  it('renders localized aside chrome, visible dates, and public links in English', () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');

    render(<BlogArticleDetails article={article} articles={[article, olderArticle]} />, { locale: 'en' });

    expect(screen.getByRole('complementary', { name: 'More topics' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'More topics:' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Older article/ })).toHaveAttribute(
      'href',
      `/en/blog/${olderArticle._id}`
    );
    expect(screen.getAllByText('15.05.2026')).toHaveLength(3);
  });
});
