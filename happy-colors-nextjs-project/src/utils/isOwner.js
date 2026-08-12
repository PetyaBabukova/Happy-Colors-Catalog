import { canUserManageOwnedProduct } from '../../../shared/productOwnership.js';

export function isOwner(product, user) {
  return canUserManageOwnedProduct(product, user);
}
