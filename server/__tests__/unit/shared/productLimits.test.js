import { describe, expect, it } from 'vitest';

import * as FrontendProductLimits from '../../../../happy-colors-nextjs-project/src/config/productLimits.js';
import * as ServerProductLimits from '../../../config/productLimits.js';
import * as SharedProductLimits from '../../../../shared/config/productLimits.js';

const EXPECTED_EXPORTS = [
  'ALLOWED_CARTOON_ORDER_PHOTO_MIME_TYPES',
  'ALLOWED_IMAGE_UPLOAD_MIME_TYPES',
  'ALLOWED_VIDEO_MIME_TYPES',
  'CARTOON_ORDER_PHOTO_PREFIX',
  'MAX_CARTOON_ORDER_PHOTO_SIZE_BYTES',
  'MAX_CARTOON_ORDER_PHOTOS',
  'MAX_IMAGE_UPLOAD_SIZE_BYTES',
  'MAX_VIDEO_DURATION_SECONDS',
  'MAX_VIDEO_UPLOAD_SIZE_BYTES',
  'MAX_VIDEOS_PER_PRODUCT',
  'RECOMMENDED_VIDEO_DURATION_SECONDS',
];

describe('shared product and upload limits', () => {
  it('keeps runtime product-limit wrappers aligned with shared exports', () => {
    for (const exportName of EXPECTED_EXPORTS) {
      expect(ServerProductLimits[exportName]).toEqual(SharedProductLimits[exportName]);
      expect(FrontendProductLimits[exportName]).toEqual(SharedProductLimits[exportName]);
    }
  });

  it('pins product video limit values', () => {
    expect(SharedProductLimits.MAX_VIDEOS_PER_PRODUCT).toBe(3);
    expect(SharedProductLimits.MAX_VIDEO_UPLOAD_SIZE_BYTES).toBe(25 * 1024 * 1024);
    expect(SharedProductLimits.MAX_VIDEO_DURATION_SECONDS).toBe(30);
    expect(SharedProductLimits.RECOMMENDED_VIDEO_DURATION_SECONDS).toBe(15);
    expect(SharedProductLimits.ALLOWED_VIDEO_MIME_TYPES).toEqual(['video/mp4']);
  });

  it('pins image upload limit values', () => {
    expect(SharedProductLimits.MAX_IMAGE_UPLOAD_SIZE_BYTES).toBe(5 * 1024 * 1024);
    expect(SharedProductLimits.ALLOWED_IMAGE_UPLOAD_MIME_TYPES).toEqual([
      'image/jpeg',
      'image/png',
      'image/webp',
    ]);
  });

  it('pins cartoon order photo limit values', () => {
    expect(SharedProductLimits.MAX_CARTOON_ORDER_PHOTOS).toBe(5);
    expect(SharedProductLimits.MAX_CARTOON_ORDER_PHOTO_SIZE_BYTES).toBe(3 * 1024 * 1024);
    expect(SharedProductLimits.ALLOWED_CARTOON_ORDER_PHOTO_MIME_TYPES).toEqual([
      'image/jpeg',
      'image/png',
      'image/webp',
    ]);
    expect(SharedProductLimits.CARTOON_ORDER_PHOTO_PREFIX).toBe('cartoon-orders/reference-photos');
  });
});
