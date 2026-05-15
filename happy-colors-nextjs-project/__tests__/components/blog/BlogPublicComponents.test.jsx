import { describe, expect, it } from 'vitest';
import BlogArticleDetails from '@/components/blog/BlogArticleDetails';
import { render, screen } from '../test-utils.jsx';

const article = {
  _id: 'a'.repeat(24),
  title: 'Цветна статия',
  excerpt: 'Кратко описание.',
  contentHtml: '<p>Полезен текст</p><ul><li>Съвет</li></ul>',
  thumbnailImageUrl: 'https://storage.googleapis.com/test-bucket/blog/articles/thumbnails/article.webp',
  heroImageUrl: 'https://storage.googleapis.com/test-bucket/blog/articles/hero/article.webp',
  heroImageAlt: 'Цветна снимка',
  publishedAt: '2026-05-15T08:00:00.000Z',
};

const olderArticle = {
  ...article,
  _id: 'b'.repeat(24),
  title: 'По-стара статия',
  thumbnailImageUrl: 'https://storage.googleapis.com/test-bucket/blog/articles/thumbnails/older.webp',
};

describe('public blog components', () => {
  it('renders article detail content and the original hero image without the blog back link', () => {
    render(<BlogArticleDetails article={article} />);

    expect(screen.queryByRole('link', { name: 'Към блога' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Цветна статия' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Цветна снимка' })).toHaveAttribute(
      'src',
      article.heroImageUrl
    );
    expect(screen.getByText('Полезен текст')).toBeInTheDocument();
    expect(screen.getByText('Съвет')).toBeInTheDocument();
  });

  it('renders an aside list and marks the selected article', () => {
    render(<BlogArticleDetails article={article} articles={[article, olderArticle]} />);

    expect(screen.getByRole('complementary', { name: 'Други теми' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Цветна статия/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /По-стара статия/ })).toHaveAttribute(
      'href',
      `/blog/${olderArticle._id}`
    );
    expect(screen.getByRole('img', { name: 'Цветна снимка' })).toHaveAttribute(
      'src',
      article.heroImageUrl
    );
    expect(document.querySelector(`img[src="${olderArticle.thumbnailImageUrl}"]`)).toBeInTheDocument();
  });
});
