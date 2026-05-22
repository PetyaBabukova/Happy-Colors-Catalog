import { canArtistManageProducts, isFullAdmin } from './userRoles.js';
import { isPublicProduct, PRODUCT_PUBLICATION_STATUSES } from './productPublication.js';

function asId(value) {
  return String(value || '');
}

export function isProductOwner(product, user) {
  if (!product || !user) {
    return false;
  }

  return asId(product.owner?._id || product.owner) === asId(user._id);
}

export function canViewProduct(product, user = null) {
  if (!product) {
    return false;
  }

  if (isPublicProduct(product) || isFullAdmin(user)) {
    return true;
  }

  return canArtistManageProducts(user) && isProductOwner(product, user);
}

export function canCreateProduct(user) {
  return isFullAdmin(user) || canArtistManageProducts(user);
}

export function canManageProduct(product, user) {
  if (!product) {
    return false;
  }

  if (isFullAdmin(user)) {
    return true;
  }

  if (!canArtistManageProducts(user) || !isProductOwner(product, user)) {
    return false;
  }

  return [
    PRODUCT_PUBLICATION_STATUSES.DRAFT,
    PRODUCT_PUBLICATION_STATUSES.REJECTED,
  ].includes(product.publicationStatus);
}

export function canManageProductMedia(product, user) {
  return canManageProduct(product, user);
}

export function canHardDeleteProduct(product, user) {
  if (!product) {
    return false;
  }

  if (isFullAdmin(user)) {
    return true;
  }

  return (
    canArtistManageProducts(user) &&
    isProductOwner(product, user) &&
    product.publicationStatus === PRODUCT_PUBLICATION_STATUSES.DRAFT
  );
}

export function canSubmitProductForReview(product, user) {
  return (
    canArtistManageProducts(user) &&
    isProductOwner(product, user) &&
    [
      PRODUCT_PUBLICATION_STATUSES.DRAFT,
      PRODUCT_PUBLICATION_STATUSES.REJECTED,
    ].includes(product?.publicationStatus)
  );
}

export function canWithdrawProductReview(product, user) {
  return (
    canArtistManageProducts(user) &&
    isProductOwner(product, user) &&
    product?.publicationStatus === PRODUCT_PUBLICATION_STATUSES.PENDING_REVIEW
  );
}

export function canReviewProduct(user) {
  return isFullAdmin(user);
}
