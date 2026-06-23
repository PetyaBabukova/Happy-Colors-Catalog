import {
  CARTOONS_SERVICE_QUERY_VALUE,
  isCartoonsServiceContext,
} from '@/config/cartoonsFeature';

function buildPathWithQuery(path, entries) {
  const params = new URLSearchParams();

  entries.forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, value);
    }
  });

  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function buildCartoonServiceContactHref({ productId } = {}) {
  return buildPathWithQuery('/contacts', [
    ['service', CARTOONS_SERVICE_QUERY_VALUE],
    ['productId', productId],
  ]);
}

export function buildCartoonServiceProductHref(productId) {
  return buildPathWithQuery(`/products/${productId}`, [
    ['service', CARTOONS_SERVICE_QUERY_VALUE],
  ]);
}

export function buildProductHref(productId, serviceContext = '') {
  if (isCartoonsServiceContext(serviceContext)) {
    return buildCartoonServiceProductHref(productId);
  }

  return `/products/${productId}`;
}
