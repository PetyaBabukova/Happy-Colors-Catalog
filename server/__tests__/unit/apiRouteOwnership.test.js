import { describe, expect, it } from 'vitest';

import {
  BACKEND_API_PREFIXES,
  getRequestPathname,
  isApiPath,
  isBackendApiPath,
} from '../../apiRouteOwnership.js';
import nextConfig from '../../../happy-colors-nextjs-project/next.config.mjs';

function rewriteSourceToBackendPrefix(source) {
  return source.replace(/\/:path\*$/, '');
}

describe('apiRouteOwnership', () => {
  it('normalizes pathnames from path-only and absolute URLs', () => {
    expect(getRequestPathname('/api/products?category=test')).toBe('/api/products');
    expect(getRequestPathname('/api/products/')).toBe('/api/products');
    expect(getRequestPathname('https://happycolors.example/api/revalidate/products?source=admin')).toBe(
      '/api/revalidate/products'
    );
  });

  it('identifies API paths', () => {
    expect(isApiPath('/api')).toBe(true);
    expect(isApiPath('/api/products')).toBe(true);
    expect(isApiPath('/products')).toBe(false);
  });

  it.each([
    '/api',
    '/api/products',
    '/api/products/123',
    '/api/products?category=test',
    '/api/payments/webhook',
    '/api/users/me',
    '/api/newsletter/send',
  ])('routes backend-owned path %s to Express', (path) => {
    expect(isBackendApiPath(path)).toBe(true);
  });

  it.each([
    '/api/revalidate/products',
    '/api/revalidate/products?source=admin',
    '/api/revalidate/blog',
    '/api/revalidate/home-banners',
    '/api/uploads/sign',
    '/api/uploads/delete',
    '/api/uploads/proxy',
    '/api/upload-image',
    '/api/blog/images',
    '/api/analytics/summary',
    '/api/offices/econt',
  ])('routes Next-owned path %s away from Express', (path) => {
    expect(isBackendApiPath(path)).toBe(false);
  });

  it.each([
    '/api/products-v2',
    '/api/productss',
    '/api/payments-webhook',
  ])('does not treat similar prefix %s as backend-owned', (path) => {
    expect(isBackendApiPath(path)).toBe(false);
  });

  it('keeps the backend prefix list explicit', () => {
    expect(BACKEND_API_PREFIXES).toEqual([
      '/api/users',
      '/api/products',
      '/api/home-banners',
      '/api/blog-articles',
      '/api/newsletter',
      '/api/categories',
      '/api/search',
      '/api/contacts',
      '/api/orders',
      '/api/payments',
      '/api/delivery',
    ]);
  });

  it('keeps backend API prefixes aligned with Next rewrites', async () => {
    const rewrites = await nextConfig.rewrites();
    const rewriteSources = rewrites.map((rewrite) => rewriteSourceToBackendPrefix(rewrite.source));

    expect([...BACKEND_API_PREFIXES].sort()).toEqual([...rewriteSources].sort());
  });
});
