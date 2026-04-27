import { currentSiteUrl } from '@/config/siteSeo';
import { normalizeImageUrls } from '@/utils/normalizeImageUrls';

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

export function buildProductSeoDescription(product) {
  const categoryName = product.category?.name;

  return categoryName
    ? `${product.title} – ${categoryName.toLowerCase()} от Happy Colors. Ръчно изработено изделие с внимание към детайла, подходящо за подарък, декорация за дома или специален повод.`
    : `${product.title} от Happy Colors. Ръчно изработено изделие с внимание към детайла, подходящо за подарък, декорация за дома или специален повод.`;
}

export function buildProductSeoTitle(product) {
  return [product.title, product.category?.name].filter(Boolean).join(' | ');
}

export function buildProductJsonLd(product) {
  const imageUrls = normalizeImageUrls(product).map(absoluteUrl);
  const videos = normalizeProductVideosForSeo(product.videos);

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.description || buildProductSeoDescription(product),
    ...(imageUrls.length ? { image: imageUrls } : {}),
    ...(product.price
      ? {
          offers: {
            '@type': 'Offer',
            price: String(product.price),
            priceCurrency: 'EUR',
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
            name: `${product.title} - видео ${index + 1}`,
            description: product.description || buildProductSeoDescription(product),
            thumbnailUrl: absoluteUrl(video.posterUrl),
            ...(normalizeUploadDate(video.uploadDate)
              ? { uploadDate: normalizeUploadDate(video.uploadDate) }
              : {}),
            contentUrl: absoluteUrl(video.url),
            encodingFormat: video.mimeType || 'video/mp4',
            ...(video.durationSeconds
              ? { duration: `PT${Math.round(video.durationSeconds)}S` }
              : {}),
          })),
        }
      : {}),
  };
}

export function stringifyJsonLd(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function buildProductMetadata(product, productId) {
  const title = buildProductSeoTitle(product);
  const description = buildProductSeoDescription(product);
  const imageUrls = normalizeImageUrls(product).map(absoluteUrl);
  const videos = normalizeProductVideosForSeo(product.videos);
  const posterUrls = videos.map((video) => absoluteUrl(video.posterUrl));
  const previewImages = [...imageUrls, ...posterUrls];

  return {
    title,
    description,
    alternates: {
      canonical: `/products/${productId}`,
    },
    openGraph: {
      title,
      description,
      type: videos.length ? 'video.other' : 'website',
      url: `/products/${productId}`,
      siteName: 'Happy Colors',
      ...(previewImages.length
        ? {
            images: previewImages.map((url) => ({
              url,
              alt: product.title,
            })),
          }
        : {}),
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
      ...(previewImages.length ? { images: [previewImages[0]] } : {}),
    },
  };
}
