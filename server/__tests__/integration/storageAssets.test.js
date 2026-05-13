import { describe, expect, it, vi } from 'vitest';
import { deleteImageFromGCS } from '../../helpers/gcsImageHelper.js';
import Product from '../../models/Product.js';
import { deleteProductImage } from '../../services/productImagesService.js';
import { deleteProductVideo } from '../../services/productVideosService.js';
import { createProduct } from './factories.js';

function buildVideo(overrides = {}) {
  return {
    url: 'https://storage.googleapis.com/test-bucket/products/videos/demo.mp4',
    posterUrl: 'https://storage.googleapis.com/test-bucket/products/posters/demo.webp',
    mimeType: 'video/mp4',
    durationSeconds: 12,
    ...overrides,
  };
}

describe('product storage asset services', () => {
  it('deletes a product image only for the owner and keeps the primary image consistent', async () => {
    const product = await createProduct({
      imageUrl: 'https://cdn.test/one.webp',
      imageUrls: ['https://cdn.test/one.webp', 'https://cdn.test/two.webp'],
    });

    await expect(deleteProductImage(product._id, 'https://cdn.test/one.webp', String(product.owner))).resolves.toEqual({
      message: expect.any(String),
      imageUrls: ['https://cdn.test/two.webp'],
      imageUrl: 'https://cdn.test/two.webp',
    });

    const updated = await Product.findById(product._id).lean();
    expect(updated.imageUrls).toEqual(['https://cdn.test/two.webp']);
    expect(updated.imageUrl).toBe('https://cdn.test/two.webp');
    expect(deleteImageFromGCS).toHaveBeenCalledWith('https://cdn.test/one.webp');
  });

  it('rejects image deletion for non-owners, unknown images, and last-image removal', async () => {
    const product = await createProduct({
      imageUrl: 'https://cdn.test/only.webp',
      imageUrls: ['https://cdn.test/only.webp'],
    });

    await expect(deleteProductImage(product._id, 'https://cdn.test/only.webp', 'other-user')).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(
      deleteProductImage(product._id, 'https://cdn.test/missing.webp', String(product.owner))
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      deleteProductImage(product._id, 'https://cdn.test/only.webp', String(product.owner))
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(deleteImageFromGCS).not.toHaveBeenCalled();
  });

  it('deletes a product video and preserves a poster still used by another video', async () => {
    const sharedPoster = 'https://storage.googleapis.com/test-bucket/products/posters/shared.webp';
    const product = await createProduct({
      videos: [
        buildVideo({
          url: 'https://storage.googleapis.com/test-bucket/products/videos/one.mp4',
          posterUrl: sharedPoster,
        }),
        buildVideo({
          url: 'https://storage.googleapis.com/test-bucket/products/videos/two.mp4',
          posterUrl: sharedPoster,
        }),
      ],
    });

    await expect(
      deleteProductVideo(product._id, 'https://storage.googleapis.com/test-bucket/products/videos/one.mp4', String(product.owner))
    ).resolves.toMatchObject({
      message: expect.any(String),
      videos: [
        expect.objectContaining({
          url: 'https://storage.googleapis.com/test-bucket/products/videos/two.mp4',
          posterUrl: sharedPoster,
        }),
      ],
    });

    const updated = await Product.findById(product._id).lean();
    expect(updated.videos).toHaveLength(1);
    expect(deleteImageFromGCS).toHaveBeenCalledTimes(1);
    expect(deleteImageFromGCS).toHaveBeenCalledWith('https://storage.googleapis.com/test-bucket/products/videos/one.mp4');
  });

  it('continues after storage deletion failures because the product state is already saved', async () => {
    const product = await createProduct({
      videos: [buildVideo()],
    });
    deleteImageFromGCS.mockRejectedValueOnce(new Error('storage outage'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(deleteProductVideo(product._id, buildVideo().url, String(product.owner))).resolves.toMatchObject({
      videos: [],
    });

    const updated = await Product.findById(product._id).lean();
    expect(updated.videos).toEqual([]);
  });

  it('rejects blank, missing, unauthorized, or unrelated video deletions', async () => {
    const product = await createProduct({ videos: [buildVideo()] });

    await expect(deleteProductVideo(product._id, '', String(product.owner))).rejects.toMatchObject({ statusCode: 400 });
    await expect(deleteProductVideo(product._id, buildVideo().url, 'other-user')).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(
      deleteProductVideo(product._id, 'https://storage.googleapis.com/test-bucket/products/videos/missing.mp4', String(product.owner))
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(deleteProductVideo('507f1f77bcf86cd799439011', buildVideo().url, String(product.owner))).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
