import Product from '../models/Product.js';
import { deleteImageFromGCS } from '../helpers/gcsImageHelper.js';
import { canManageProductMedia } from '../utils/productPermissions.js';

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function canDeleteMedia(product, user) {
  if (typeof user === 'string') {
    return product.owner.toString() === user;
  }

  return canManageProductMedia(product, user);
}

export async function deleteProductImage(productId, imageUrl, user) {
  const product = await Product.findById(productId);

  if (!product) {
    throw createError('Продуктът не беше намерен.', 404);
  }

  if (!canDeleteMedia(product, user)) {
    throw createError('Нямате права да редактирате този продукт.', 403);
  }

  const currentImageUrls =
    Array.isArray(product.imageUrls) && product.imageUrls.length > 0
      ? product.imageUrls.filter(Boolean)
      : product.imageUrl
        ? [product.imageUrl]
        : [];

  if (!currentImageUrls.includes(imageUrl)) {
    throw createError('Изображението не принадлежи на този продукт.', 400);
  }

  const updatedImages = currentImageUrls.filter((img) => img !== imageUrl);

  if (updatedImages.length === 0) {
    throw createError('Продуктът трябва да има поне едно изображение.', 400);
  }

  product.imageUrls = updatedImages;
  product.imageUrl = updatedImages[0] || '';

  await product.save();
  await deleteImageFromGCS(imageUrl);

  return {
    message: 'Изображението беше изтрито.',
    imageUrls: updatedImages,
    imageUrl: updatedImages[0] || '',
  };
}
