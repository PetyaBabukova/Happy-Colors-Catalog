import Product from '../models/Product.js';
import { deleteImageFromGCS } from '../helpers/gcsImageHelper.js';
import { normalizeStoredVideos } from '../helpers/productVideoHelper.js';

export async function deleteProductVideo(productId, videoUrl, userId) {
  if (!String(videoUrl || '').trim()) {
    const error = new Error('Липсва video URL за изтриване.');
    error.statusCode = 400;
    throw error;
  }

  const product = await Product.findById(productId);

  if (!product) {
    const error = new Error('Продуктът не беше намерен.');
    error.statusCode = 404;
    throw error;
  }

  if (product.owner.toString() !== userId) {
    const error = new Error('Нямате права да редактирате този продукт.');
    error.statusCode = 403;
    throw error;
  }

  const currentVideos = normalizeStoredVideos(product.videos);
  const videoToDelete = currentVideos.find((video) => video.url === videoUrl);

  if (!videoToDelete) {
    const error = new Error('Видеото не принадлежи на този продукт.');
    error.statusCode = 400;
    throw error;
  }

  const remainingVideos = currentVideos.filter((video) => video.url !== videoUrl);
  const remainingPosterUrls = new Set(remainingVideos.map((video) => video.posterUrl));
  product.videos = remainingVideos;

  await product.save();

  const deletions = [deleteImageFromGCS(videoToDelete.url)];

  if (!remainingPosterUrls.has(videoToDelete.posterUrl)) {
    deletions.push(deleteImageFromGCS(videoToDelete.posterUrl));
  }

  try {
    await Promise.all(deletions);
  } catch (error) {
    console.error('Error while deleting single video assets from storage:', error);
  }

  return {
    message: 'Видеото беше изтрито.',
    videos: remainingVideos,
  };
}
