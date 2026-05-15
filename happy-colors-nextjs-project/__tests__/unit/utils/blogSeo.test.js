import { describe, expect, it } from 'vitest';
import {
  buildBlogArticleJsonLd,
  buildBlogMetadata,
  buildBlogSeoDescription,
  buildBlogSeoTitle,
  stringifyJsonLd,
} from '@/utils/blogSeo';

const article = {
  _id: 'article-1',
  title: 'Цветна блог статия',
  excerpt: 'Кратко описание за статията.',
  contentText: 'Дълъг текст на статията.',
  heroImageUrl: 'https://storage.googleapis.com/test-bucket/blog/articles/hero/article.webp',
  thumbnailImageUrl: 'https://storage.googleapis.com/test-bucket/blog/articles/thumbnails/article.webp',
  heroImageAlt: 'Цветно изображение',
  seoTitle: 'SEO заглавие',
  seoDescription: 'SEO описание.',
  publishedAt: '2026-05-15T08:00:00.000Z',
  updatedAt: '2026-05-15T09:00:00.000Z',
};

describe('blogSeo', () => {
  it('prefers explicit SEO title and description with fallbacks', () => {
    expect(buildBlogSeoTitle(article)).toBe('SEO заглавие');
    expect(buildBlogSeoDescription(article)).toBe('SEO описание.');
    expect(buildBlogSeoTitle({ title: 'Fallback title' })).toBe('Fallback title');
    expect(buildBlogSeoDescription({ excerpt: 'Fallback excerpt' })).toBe('Fallback excerpt');
  });

  it('builds article metadata with canonical, Open Graph, and Twitter image data', () => {
    const metadata = buildBlogMetadata(article, article._id);

    expect(metadata.title).toBe('SEO заглавие');
    expect(metadata.description).toBe('SEO описание.');
    expect(metadata.alternates.canonical).toBe('/blog/article-1');
    expect(metadata.openGraph.type).toBe('article');
    expect(metadata.openGraph.images).toEqual([
      {
        url: 'https://storage.googleapis.com/test-bucket/blog/articles/hero/article.webp',
        alt: 'Цветно изображение',
      },
    ]);
    expect(metadata.twitter.images).toEqual([
      'https://storage.googleapis.com/test-bucket/blog/articles/hero/article.webp',
    ]);
  });

  it('builds BlogPosting JSON-LD and escapes serialized script content', () => {
    const jsonLd = buildBlogArticleJsonLd(
      {
        ...article,
        title: '<script>Title</script>',
      },
      article._id
    );

    expect(jsonLd['@type']).toBe('BlogPosting');
    expect(jsonLd.url).toBe('http://localhost:3000/blog/article-1');
    expect(jsonLd.image).toEqual([
      'https://storage.googleapis.com/test-bucket/blog/articles/hero/article.webp',
    ]);
    expect(stringifyJsonLd(jsonLd)).toContain('\\u003cscript');
  });
});
