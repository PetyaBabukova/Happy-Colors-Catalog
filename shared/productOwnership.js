function asId(value) {
  return String(value || '');
}

export function getProductOwnerId(product) {
  if (!product?.owner || typeof product.owner !== 'object') {
    return asId(product?.owner);
  }

  if ('_id' in product.owner) {
    return asId(product.owner._id);
  }

  return product.owner.toString === Object.prototype.toString
    ? ''
    : asId(product.owner);
}

export function getUserId(userOrId) {
  return asId(userOrId?._id || userOrId);
}

export function isProductOwner(product, userOrId) {
  const ownerId = getProductOwnerId(product);
  const userId = getUserId(userOrId);

  return Boolean(ownerId && userId && ownerId === userId);
}

export function canUserManageOwnedProduct(product, user) {
  if (!product || !user) {
    return false;
  }

  return user.role === 'full_admin' || isProductOwner(product, user);
}
