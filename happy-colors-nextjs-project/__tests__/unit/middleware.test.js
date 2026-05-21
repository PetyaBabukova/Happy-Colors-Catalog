import { describe, expect, it } from 'vitest';
import { isProtectedPagePath } from '../../src/middleware.js';

describe('middleware protected page paths', () => {
  it('protects owner-only pages before rendering the app shell', () => {
    expect(isProtectedPagePath('/newsletter/send')).toBe(true);
    expect(isProtectedPagePath('/products/create')).toBe(true);
    expect(isProtectedPagePath('/products/product-1/edit')).toBe(true);
    expect(isProtectedPagePath('/products/product-1/delete')).toBe(true);
    expect(isProtectedPagePath('/blog/article-1/edit')).toBe(true);
    expect(isProtectedPagePath('/categories')).toBe(true);
  });

  it('leaves public pages public', () => {
    expect(isProtectedPagePath('/')).toBe(false);
    expect(isProtectedPagePath('/products')).toBe(false);
    expect(isProtectedPagePath('/products/product-1')).toBe(false);
    expect(isProtectedPagePath('/blog')).toBe(false);
    expect(isProtectedPagePath('/contacts')).toBe(false);
  });
});
