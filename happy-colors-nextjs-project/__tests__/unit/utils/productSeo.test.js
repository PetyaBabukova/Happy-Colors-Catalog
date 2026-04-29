import { describe, expect, it } from 'vitest';
import {
  buildProductJsonLd,
  buildProductMetadata,
  buildProductSeoTitle,
  normalizeProductVideosForSeo,
  stringifyJsonLd,
} from '../../../src/utils/productSeo.js';

describe('productSeo', () => {
  const product = {
    _id: 'product-1',
    title: 'Colorful Candle',
    description: 'Handmade candle',
    price: 12,
    availability: 'available',
    category: { name: 'Candles' },
    imageUrls: ['/images/candle.webp'],
    videos: [
      {
        url: '/videos/candle.mp4',
        posterUrl: '/posters/candle.webp',
        mimeType: 'video/mp4',
        durationSeconds: 8.3,
        uploadDate: '2026-04-01T10:00:00.000Z',
      },
      {
        url: '/videos/missing-poster.mp4',
      },
    ],
  };

  it('normalizes only videos with a URL and poster URL', () => {
    expect(normalizeProductVideosForSeo(product.videos)).toEqual([
      {
        url: '/videos/candle.mp4',
        posterUrl: '/posters/candle.webp',
        mimeType: 'video/mp4',
        durationSeconds: 8.3,
        uploadDate: '2026-04-01T10:00:00.000Z',
      },
    ]);
  });

  it('builds product title from title and category', () => {
    expect(buildProductSeoTitle(product)).toBe('Colorful Candle | Candles');
  });

  it('builds JSON-LD with offer and video metadata', () => {
    const jsonLd = buildProductJsonLd(product);

    expect(jsonLd).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Colorful Candle',
      description: 'Handmade candle',
      offers: {
        '@type': 'Offer',
        price: '12',
        priceCurrency: 'EUR',
        availability: 'https://schema.org/InStock',
      },
    });
    expect(jsonLd.image).toEqual(['http://localhost:3000/images/candle.webp']);
    expect(jsonLd.video[0]).toMatchObject({
      '@type': 'VideoObject',
      contentUrl: 'http://localhost:3000/videos/candle.mp4',
      thumbnailUrl: 'http://localhost:3000/posters/candle.webp',
      duration: 'PT8S',
    });
  });

  it('builds metadata with video Open Graph data', () => {
    const metadata = buildProductMetadata(product, product._id);

    expect(metadata.title).toBe('Colorful Candle | Candles');
    expect(metadata.alternates.canonical).toBe('/products/product-1');
    expect(metadata.openGraph.type).toBe('video.other');
    expect(metadata.openGraph.videos).toEqual([
      {
        url: 'http://localhost:3000/videos/candle.mp4',
        secureUrl: 'http://localhost:3000/videos/candle.mp4',
        type: 'video/mp4',
      },
    ]);
  });

  it('escapes unsafe JSON-LD characters', () => {
    expect(stringifyJsonLd({ value: '<script>' })).toBe('{"value":"\\u003cscript>"}');
  });
});
