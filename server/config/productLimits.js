// Keep this file aligned with happy-colors-nextjs-project/src/config/productLimits.js until we extract shared config.
export const MAX_VIDEOS_PER_PRODUCT = 3;
export const MAX_VIDEO_DURATION_SECONDS = 30;
export const ALLOWED_VIDEO_MIME_TYPES = ['video/mp4'];

export const MAX_CARTOON_ORDER_PHOTOS = 5;
export const MAX_CARTOON_ORDER_PHOTO_SIZE_BYTES = 3 * 1024 * 1024;
export const ALLOWED_CARTOON_ORDER_PHOTO_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];
export const CARTOON_ORDER_PHOTO_PREFIX = 'cartoon-orders/reference-photos';
