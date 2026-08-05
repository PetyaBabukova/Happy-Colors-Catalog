export const CARTOONS_SERVICE_PATH = '/cartoons';
export const CARTOONS_SERVICE_QUERY_VALUE = 'cartoons';

export const isCartoonsServiceEnabled =
  process.env.NEXT_PUBLIC_CARTOONS_SERVICE_ENABLED === 'true';

export function isCartoonsServiceContext(value) {
  return value === CARTOONS_SERVICE_QUERY_VALUE;
}

export function getReleasedServiceContext(value) {
  return isCartoonsServiceEnabled && isCartoonsServiceContext(value)
    ? CARTOONS_SERVICE_QUERY_VALUE
    : '';
}

export function getReleasedServiceContextFromSearchParams(searchParams) {
  return getReleasedServiceContext(searchParams?.service);
}
