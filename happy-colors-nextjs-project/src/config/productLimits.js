// Keep this file aligned with server/config/productLimits.js until we extract shared config.
export const MAX_VIDEOS_PER_PRODUCT = 3;
export const MAX_VIDEO_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024;
export const MAX_VIDEO_DURATION_SECONDS = 30;
export const RECOMMENDED_VIDEO_DURATION_SECONDS = 15;

export const ALLOWED_VIDEO_MIME_TYPES = ['video/mp4'];
export const ALLOWED_IMAGE_UPLOAD_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

export const MAX_IMAGE_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;
