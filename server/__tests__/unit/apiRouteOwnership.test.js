import { describe, expect, it } from 'vitest';

import {
  BACKEND_API_EXACT_PATHS,
  BACKEND_API_PREFIXES,
  NEXT_API_EXACT_PATHS,
  getRequestPathname,
  isApiPath,
  isBackendApiPath,
} from '../../apiRouteOwnership.js';
import nextConfig from '../../../happy-colors-nextjs-project/next.config.mjs';

function normalizeRewriteSource(source) {
  return source
    .replace(/\/:path\*$/, '')
    .replace(/\/:orderId\(\[a-fA-F0-9\]\{24\}\)(\/|$)/, '/:orderId$1');
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
    '/api/cartoon-orders',
    '/api/cartoon-orders/665f1f77bcf86cd799439011',
    '/api/cartoon-orders/665f1f77bcf86cd799439011/statuses',
    '/api/cartoon-orders/665f1f77bcf86cd799439011/admin-notes',
    '/api/cartoon-orders/665f1f77bcf86cd799439011/complete',
  ])('routes backend-owned path %s to Express', (path) => {
    expect(isBackendApiPath(path)).toBe(true);
  });

  it.each([
    '/api/revalidate/products',
    '/api/revalidate/products?source=admin',
    '/api/revalidate/blog',
    '/api/revalidate/home-banners',
    '/api/revalidate/cartoon-hero-banners',
    '/api/uploads/sign',
    '/api/uploads/delete',
    '/api/uploads/proxy',
    '/api/upload-image',
    '/api/blog/images',
    '/api/analytics/summary',
    '/api/offices/econt',
    '/api/cartoon-orders/upload-session',
    '/api/cartoon-orders/uploads',
  ])('routes Next-owned path %s away from Express', (path) => {
    expect(isBackendApiPath(path)).toBe(false);
  });

  it.each([
    '/api/products-v2',
    '/api/productss',
    '/api/payments-webhook',
    '/api/cartoon-orders/not-an-object-id',
    '/api/cartoon-orders/665f1f77bcf86cd799439011/history',
    '/api/cartoon-orders/upload-session/refresh',
  ])('does not treat similar prefix %s as backend-owned', (path) => {
    expect(isBackendApiPath(path)).toBe(false);
  });

  it('keeps cartoon order backend ownership limited to explicit admin routes', () => {
    expect(isBackendApiPath('/api/cartoon-orders/665f1f77bcf86cd799439011')).toBe(true);
    expect(isBackendApiPath('/api/cartoon-orders/665f1f77bcf86cd799439011/statuses')).toBe(true);
    expect(isBackendApiPath('/api/cartoon-orders/665f1f77bcf86cd799439011/admin-notes')).toBe(true);
    expect(isBackendApiPath('/api/cartoon-orders/665f1f77bcf86cd799439011/complete')).toBe(true);

    expect(isBackendApiPath('/api/cartoon-orders/upload-session')).toBe(false);
    expect(isBackendApiPath('/api/cartoon-orders/uploads')).toBe(false);
    expect(isBackendApiPath('/api/cartoon-orders/future-next-route')).toBe(false);
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
    expect(BACKEND_API_EXACT_PATHS).toEqual([
      '/api/cartoon-orders',
    ]);
    expect(NEXT_API_EXACT_PATHS).toEqual([
      '/api/cartoon-orders/upload-session',
      '/api/cartoon-orders/uploads',
    ]);
  });

  it('keeps backend API prefixes aligned with Next rewrites', async () => {
    const rewrites = await nextConfig.rewrites();
    const rewriteSources = rewrites.map((rewrite) => normalizeRewriteSource(rewrite.source));
    const backendApiPaths = [
      ...BACKEND_API_PREFIXES,
      ...BACKEND_API_EXACT_PATHS,
      '/api/cartoon-orders/:orderId',
      '/api/cartoon-orders/:orderId/statuses',
      '/api/cartoon-orders/:orderId/admin-notes',
      '/api/cartoon-orders/:orderId/complete',
    ];

    expect(backendApiPaths.sort()).toEqual([...rewriteSources].sort());
  });
});
