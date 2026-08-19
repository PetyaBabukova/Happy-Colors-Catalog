import {
  buildBreadcrumbListJsonLd,
  buildLocalizedAlternates,
  buildStructuredDataId,
  buildStructuredDataUrl,
  currentSiteUrl,
  getLocalizedCanonicalPath,
  getOrganizationReference,
  getOpenGraphAlternateLocales,
  getOpenGraphLocale,
  getStructuredDataLanguage,
  SITE_OG_IMAGE_PATH,
} from '@/config/siteSeo';
import { DEFAULT_LOCALE } from '@/i18n/config';
import { stringifyJsonLd } from '@/utils/jsonLd';
import { normalizeImageUrls } from '@/utils/normalizeImageUrls';

export { stringifyJsonLd };

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

export function normalizeProductVideosForSeo(videos) {
  return Array.isArray(videos)
    ? videos
        .filter((video) => video?.url && video?.posterUrl)
        .map((video) => ({
          url: video.url,
          posterUrl: video.posterUrl,
          mimeType: video.mimeType || 'video/mp4',
          durationSeconds: Number(video.durationSeconds) || 0,
          uploadDate: video.uploadDate || '',
        }))
    : [];
}

function normalizeUploadDate(value) {
  if (!value) {
    return '';
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return '';
  }

  return parsedDate.toISOString();
}

function getProductSeoCategoryName(product, locale) {
  const category = product?.category;
  const isCategoryFallback =
    locale === 'en' &&
    category?.contentLocale === DEFAULT_LOCALE &&
    category?.translationPending === true;

  return isCategoryFallback ? '' : category?.name;
}

function getProductPagePath(productId) {
  return `/products/${productId || ''}`.replace(/\/+$/, '') || '/products';
}

function normalizeOfferPrice(value) {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  const normalizedValue = String(value).trim();
  const parsedValue = Number(normalizedValue);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return '';
  }

  return normalizedValue;
}

export function buildProductSeoDescription(product, locale = DEFAULT_LOCALE) {
  const categoryName = getProductSeoCategoryName(product, locale);

  if (locale === 'en') {
    return categoryName
      ? `${product.title} - ${categoryName.toLowerCase()} from Happy Colors. A handmade piece crafted with attention to detail, suitable as a gift, home decoration, or for a special occasion.`
      : `${product.title} from Happy Colors. A handmade piece crafted with attention to detail, suitable as a gift, home decoration, or for a special occasion.`;
  }

  return categoryName
    ? `${product.title} – ${categoryName.toLowerCase()} от Happy Colors (Хепи Колорс). Ръчно изработено изделие с внимание към детайла, подходящо за подарък, декорация за дома или специален повод.`
    : `${product.title} от Happy Colors (Хепи Колорс). Ръчно изработено изделие с внимание към детайла, подходящо за подарък, декорация за дома или специален повод.`;
}

export function buildProductSeoTitle(product, locale = DEFAULT_LOCALE) {
  return [product.title, getProductSeoCategoryName(product, locale)].filter(Boolean).join(' | ');
}

export function isProductTranslationFallback(product, locale) {
  return locale === 'en' && product?.contentLocale === DEFAULT_LOCALE && product?.translationPending === true;
}

export function shouldRenderProductJsonLd(product, locale) {
  return !isProductTranslationFallback(product, locale);
}

function getProductAlternateLocales(product, locale, isFallback) {
  if (isFallback) {
    return [DEFAULT_LOCALE];
  }

  if (Array.isArray(product?.availableLocales) && product.availableLocales.length > 0) {
    return product.availableLocales;
  }

  return locale === 'en' ? [DEFAULT_LOCALE, 'en'] : [DEFAULT_LOCALE];
}

export function buildProductJsonLd(product, locale = DEFAULT_LOCALE, productId = product?._id) {
  const productPath = getProductPagePath(productId);
  const canonicalPath = getLocalizedCanonicalPath(productPath, locale);
  const productUrl = buildStructuredDataUrl(canonicalPath);
  const organizationReference = getOrganizationReference();
  const categoryName = getProductSeoCategoryName(product, locale);
  const offerPrice = normalizeOfferPrice(product?.price);
  const imageUrls = normalizeImageUrls(product).map((url) => buildStructuredDataUrl(url));
  const videos = normalizeProductVideosForSeo(product.videos);

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': buildStructuredDataId(canonicalPath, 'product'),
    name: product.title,
    description: product.description || buildProductSeoDescription(product, locale),
    url: productUrl,
    brand: organizationReference,
    inLanguage: getStructuredDataLanguage(locale),
    ...(categoryName ? { category: categoryName } : {}),
    ...(imageUrls.length ? { image: imageUrls } : {}),
    ...(offerPrice
      ? {
          offers: {
            '@type': 'Offer',
            price: offerPrice,
            priceCurrency: 'EUR',
            seller: organizationReference,
            itemCondition: 'https://schema.org/NewCondition',
            availability:
              product.availability === 'unavailable'
                ? 'https://schema.org/OutOfStock'
                : 'https://schema.org/InStock',
          },
        }
      : {}),
    ...(videos.length
      ? {
          video: videos.map((video, index) => ({
            '@type': 'VideoObject',
            name: locale === 'en'
              ? `${product.title} - video ${index + 1}`
              : `${product.title} - видео ${index + 1}`,
            description: product.description || buildProductSeoDescription(product, locale),
            thumbnailUrl: buildStructuredDataUrl(video.posterUrl),
            ...(normalizeUploadDate(video.uploadDate)
              ? { uploadDate: normalizeUploadDate(video.uploadDate) }
              : {}),
            contentUrl: buildStructuredDataUrl(video.url),
            encodingFormat: video.mimeType || 'video/mp4',
            ...(video.durationSeconds
              ? { duration: `PT${Math.round(video.durationSeconds)}S` }
              : {}),
          })),
        }
      : {}),
  };
}

export function buildProductBreadcrumbJsonLd(product, locale = DEFAULT_LOCALE, productId = product?._id) {
  const productPath = getProductPagePath(productId);
  const canonicalPath = getLocalizedCanonicalPath(productPath, locale);

  return buildBreadcrumbListJsonLd([
    {
      name: locale === 'en' ? 'Home' : 'Начало',
      path: getLocalizedCanonicalPath('/', locale),
    },
    {
      name: locale === 'en' ? 'Products' : 'Продукти',
      path: getLocalizedCanonicalPath('/products', locale),
    },
    {
      name: product?.title || (locale === 'en' ? 'Product' : 'Продукт'),
      path: canonicalPath,
    },
  ]);
}

export function buildProductMetadata(product, productId, locale) {
  const isFallback = isProductTranslationFallback(product, locale);
  const metadataLocale = isFallback ? DEFAULT_LOCALE : locale;
  const title = buildProductSeoTitle(product, metadataLocale);
  const description = buildProductSeoDescription(product, metadataLocale);
  const productPath = `/products/${productId}`;
  const alternates = buildLocalizedAlternates(
    productPath,
    isFallback ? DEFAULT_LOCALE : locale,
    { enabledLocales: getProductAlternateLocales(product, locale, isFallback) }
  );
  const canonicalPath = alternates.canonical;
  const alternateLocale = getOpenGraphAlternateLocales(metadataLocale, {
    enabledLocales: getProductAlternateLocales(product, locale, isFallback),
  });
  const imageUrls = normalizeImageUrls(product).map(absoluteUrl);
  const videos = normalizeProductVideosForSeo(product.videos);
  const posterUrls = videos.map((video) => absoluteUrl(video.posterUrl));
  const previewImages = [...imageUrls, ...posterUrls];
  const metadataImages = previewImages.length
    ? previewImages
    : [absoluteUrl(SITE_OG_IMAGE_PATH)];

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
      type: videos.length ? 'video.other' : 'website',
      url: canonicalPath,
      siteName: 'Happy Colors',
      locale: getOpenGraphLocale(metadataLocale),
      ...(alternateLocale.length ? { alternateLocale } : {}),
      images: metadataImages.map((url) => ({
        url,
        alt: product.title || 'Happy Colors',
      })),
      ...(videos.length
        ? {
            videos: videos.map((video) => ({
              url: absoluteUrl(video.url),
              secureUrl: absoluteUrl(video.url),
              type: video.mimeType || 'video/mp4',
            })),
          }
        : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [metadataImages[0]],
    },
  };
}
