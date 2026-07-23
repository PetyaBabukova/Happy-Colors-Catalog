import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildBlogArticleJsonLd,
  buildBlogMetadata,
  buildBlogSeoDescription,
  buildBlogSeoTitle,
  shouldRenderBlogArticleJsonLd,
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
  afterEach(() => {
    vi.unstubAllEnvs();
  });

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
    expect(metadata.alternates.languages).toEqual({
      bg: '/blog/article-1',
      'x-default': '/blog/article-1',
    });
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

  it('uses the site Open Graph image when an article image is missing', () => {
    const metadata = buildBlogMetadata(
      {
        ...article,
        heroImageUrl: '',
        thumbnailImageUrl: '',
      },
      article._id
    );
    const jsonLd = buildBlogArticleJsonLd(
      {
        ...article,
        heroImageUrl: '',
        thumbnailImageUrl: '',
      },
      article._id
    );

    expect(metadata.openGraph.images).toEqual([
      {
        url: 'http://localhost:3000/og/happy-colors-og.png',
        alt: 'Цветно изображение',
      },
    ]);
    expect(metadata.twitter.images).toEqual(['http://localhost:3000/og/happy-colors-og.png']);
    expect(jsonLd.image).toEqual(['http://localhost:3000/og/happy-colors-og.png']);
  });
  it('adds English article hreflang only for a real English article page', () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');

    const metadata = buildBlogMetadata(
      {
        ...article,
        availableLocales: ['bg', 'en'],
        contentLocale: 'en',
        translationPending: false,
      },
      article._id,
      'en'
    );

    expect(metadata.alternates).toEqual({
      canonical: '/en/blog/article-1',
      languages: {
        bg: '/bg/blog/article-1',
        en: '/en/blog/article-1',
        'x-default': '/bg/blog/article-1',
      },
    });
  });

  it('adds reciprocal English hreflang for Bulgarian articles with a valid English alternate', () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');

    const metadata = buildBlogMetadata(
      {
        ...article,
        availableLocales: ['bg', 'en'],
      },
      article._id,
      'bg'
    );

    expect(metadata.alternates).toEqual({
      canonical: '/bg/blog/article-1',
      languages: {
        bg: '/bg/blog/article-1',
        en: '/en/blog/article-1',
        'x-default': '/bg/blog/article-1',
      },
    });
  });

  it('marks a defensive English blog fallback as noindex with a Bulgarian canonical', () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');
    const fallbackArticle = {
      ...article,
      availableLocales: ['bg'],
      contentLocale: 'bg',
      translationPending: true,
    };

    const metadata = buildBlogMetadata(fallbackArticle, article._id, 'en');

    expect(shouldRenderBlogArticleJsonLd(fallbackArticle, 'en')).toBe(false);
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.alternates).toEqual({
      canonical: '/bg/blog/article-1',
      languages: {
        bg: '/bg/blog/article-1',
        'x-default': '/bg/blog/article-1',
      },
    });
  });
});
