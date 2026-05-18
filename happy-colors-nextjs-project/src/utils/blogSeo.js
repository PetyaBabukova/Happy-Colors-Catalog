import { currentSiteUrl } from '@/config/siteSeo';
import { stringifyJsonLd } from '@/utils/productSeo';

function absoluteUrl(url) {
  if (!url) {
    return '';
  }

  try {
    return new URL(url, currentSiteUrl).toString();
  } catch {
    return url;
  }
}

export function buildBlogSeoTitle(article) {
  return article?.seoTitle || article?.title || 'Блог';
}

export function buildBlogSeoDescription(article) {
  return article?.seoDescription || article?.excerpt || article?.contentText || 'Идеи, истории и вдъхновение от Happy Colors (Хепи Колорс).';
}

export function buildBlogMetadata(article, articleId) {
  const title = buildBlogSeoTitle(article);
  const description = buildBlogSeoDescription(article);
  const imageUrl = absoluteUrl(article?.heroImageUrl || article?.thumbnailImageUrl);

  return {
    title,
    description,
    alternates: {
      canonical: `/blog/${articleId}`,
    },
    openGraph: {
      title,
      description,
      type: 'article',
      url: `/blog/${articleId}`,
      siteName: 'Happy Colors | Хепи Колорс',
      ...(article?.publishedAt ? { publishedTime: article.publishedAt } : {}),
      ...(article?.updatedAt ? { modifiedTime: article.updatedAt } : {}),
      ...(imageUrl
        ? {
            images: [
              {
                url: imageUrl,
                alt: article?.heroImageAlt || article?.title || 'Happy Colors blog',
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
  };
}

export function buildBlogArticleJsonLd(article, articleId) {
  const imageUrl = absoluteUrl(article?.heroImageUrl || article?.thumbnailImageUrl);

  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article?.title || '',
    description: buildBlogSeoDescription(article),
    url: absoluteUrl(`/blog/${articleId}`),
    ...(imageUrl ? { image: [imageUrl] } : {}),
    ...(article?.publishedAt ? { datePublished: article.publishedAt } : {}),
    ...(article?.updatedAt ? { dateModified: article.updatedAt } : {}),
    author: {
      '@type': 'Organization',
      name: 'Happy Colors',
      alternateName: ['Хепи Колорс', 'Хепи Калърс'],
    },
    publisher: {
      '@type': 'Organization',
      name: 'Happy Colors',
      alternateName: ['Хепи Колорс', 'Хепи Калърс'],
    },
  };
}

export { stringifyJsonLd };
