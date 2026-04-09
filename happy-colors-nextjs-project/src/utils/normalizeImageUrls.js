export function normalizeImageUrls(product) {
  if (Array.isArray(product?.imageUrls) && product.imageUrls.length > 0) {
    return product.imageUrls.filter(Boolean);
  }

  if (product?.imageUrl) {
    return [product.imageUrl];
  }

  return [];
}
