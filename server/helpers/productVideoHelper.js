import { extractObjectNameFromGcsUrl } from './gcsImageHelper.js';

export function normalizeStoredVideos(videos) {
  if (!Array.isArray(videos)) {
    return [];
  }

  return videos
    .filter((video) => video && typeof video === 'object')
    .map((video) => {
      const durationSeconds = Number(video.durationSeconds);
      const uploadDate = video.uploadDate ? new Date(video.uploadDate) : new Date();

      return {
        url: typeof video.url === 'string' ? video.url.trim() : '',
        posterUrl: typeof video.posterUrl === 'string' ? video.posterUrl.trim() : '',
        mimeType: typeof video.mimeType === 'string' ? video.mimeType.trim().toLowerCase() : '',
        durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : 0,
        uploadDate: Number.isNaN(uploadDate.getTime()) ? new Date() : uploadDate,
      };
    })
    .filter((video) => video.url && video.posterUrl);
}

export function isAllowedVideoStorageUrl(assetUrl) {
  const objectName = extractObjectNameFromGcsUrl(assetUrl) || '';
  return objectName.startsWith('products/videos/');
}

export function isAllowedPosterStorageUrl(assetUrl) {
  const objectName = extractObjectNameFromGcsUrl(assetUrl) || '';
  return objectName.startsWith('products/posters/');
}
