import { isProductOwner } from '../../shared/productOwnership.js';

export function isOwner(product, userId) {
  return isProductOwner(product, userId);
}
