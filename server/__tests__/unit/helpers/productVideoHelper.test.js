import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  isAllowedPosterStorageUrl,
  isAllowedVideoStorageUrl,
  normalizeStoredVideos,
} from '../../../helpers/productVideoHelper.js';

describe('productVideoHelper', () => {
  beforeEach(() => {
    process.env.GCS_BUCKET_NAME = 'happy-bucket';
  });

  afterEach(() => {
    delete process.env.GCS_BUCKET_NAME;
  });

  it('normalizes valid stored videos and removes incomplete entries', () => {
    const videos = normalizeStoredVideos([
      {
        url: ' https://storage.googleapis.com/happy-bucket/products/videos/a.mp4 ',
        posterUrl: ' https://storage.googleapis.com/happy-bucket/products/posters/a.webp ',
        mimeType: ' VIDEO/MP4 ',
        durationSeconds: '12.4',
        uploadDate: '2026-04-01T10:00:00.000Z',
      },
      {
        url: '',
        posterUrl: 'https://storage.googleapis.com/happy-bucket/products/posters/b.webp',
      },
    ]);

    expect(videos).toHaveLength(1);
    expect(videos[0]).toMatchObject({
      url: 'https://storage.googleapis.com/happy-bucket/products/videos/a.mp4',
      posterUrl: 'https://storage.googleapis.com/happy-bucket/products/posters/a.webp',
      mimeType: 'video/mp4',
      durationSeconds: 12.4,
    });
    expect(videos[0].uploadDate).toBeInstanceOf(Date);
  });

  it('returns an empty array for non-array input', () => {
    expect(normalizeStoredVideos(null)).toEqual([]);
  });

  it('allows only expected video and poster storage folders', () => {
    expect(
      isAllowedVideoStorageUrl('https://storage.googleapis.com/happy-bucket/products/videos/a.mp4')
    ).toBe(true);
    expect(
      isAllowedVideoStorageUrl('https://storage.googleapis.com/happy-bucket/products/posters/a.webp')
    ).toBe(false);
    expect(
      isAllowedPosterStorageUrl('https://storage.googleapis.com/happy-bucket/products/posters/a.webp')
    ).toBe(true);
    expect(
      isAllowedPosterStorageUrl('https://storage.googleapis.com/happy-bucket/products/videos/a.mp4')
    ).toBe(false);
  });
});
