import {
  SITE_OG_IMAGE_PATH,
  buildLocalizedAlternates,
  currentSiteUrl,
  getLocalizedCanonicalPath,
} from '@/config/siteSeo';
import { DEFAULT_LOCALE } from '@/i18n/config';
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

export function isBlogArticleTranslationFallback(article, locale) {
  return locale === 'en' && article?.contentLocale === DEFAULT_LOCALE && article?.translationPending === true;
}

export function shouldRenderBlogArticleJsonLd(article, locale) {
  return !isBlogArticleTranslationFallback(article, locale);
}

function getBlogArticleAlternateLocales(article, locale, isFallback) {
  if (isFallback) {
    return [DEFAULT_LOCALE];
  }

  if (Array.isArray(article?.availableLocales) && article.availableLocales.length > 0) {
    return article.availableLocales;
  }

  return locale === 'en' ? [DEFAULT_LOCALE, 'en'] : [DEFAULT_LOCALE];
}

export function buildBlogMetadata(article, articleId, locale) {
  const title = buildBlogSeoTitle(article);
  const description = buildBlogSeoDescription(article);
  const isFallback = isBlogArticleTranslationFallback(article, locale);
  const articlePath = `/blog/${articleId}`;
  const alternates = buildLocalizedAlternates(
    articlePath,
    isFallback ? DEFAULT_LOCALE : locale,
    { enabledLocales: getBlogArticleAlternateLocales(article, locale, isFallback) }
  );
  const canonicalPath = alternates.canonical;
  const imageUrl = absoluteUrl(article?.heroImageUrl || article?.thumbnailImageUrl || SITE_OG_IMAGE_PATH);

  return {
    title,
    description,
    ...(isFallback
      ? {
          robots: {
            index: false,
            follow: true,
          },
        }
      : {}),
    alternates,
    openGraph: {
      title,
      description,
      type: 'article',
      url: canonicalPath,
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

export function buildBlogArticleJsonLd(article, articleId, locale) {
  const canonicalPath = getLocalizedCanonicalPath(`/blog/${articleId}`, locale);
  const imageUrl = absoluteUrl(article?.heroImageUrl || article?.thumbnailImageUrl || SITE_OG_IMAGE_PATH);

  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article?.title || '',
    description: buildBlogSeoDescription(article),
    url: absoluteUrl(canonicalPath),
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
