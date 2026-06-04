export function isOwner(product, user) {
  if (!product || !user) return false;
  if (user.role === 'full_admin') return true;
  return product.owner === user._id;
}
