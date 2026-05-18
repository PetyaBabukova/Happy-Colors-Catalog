import { describe, expect, it } from 'vitest';
import { buildLoginRedirectUrl, getSafeRedirectPath } from '@/utils/authRedirect';

const ORIGIN = 'https://happy-colors.example';

describe('auth redirect helpers', () => {
  it('accepts internal paths with query strings and hashes', () => {
    expect(getSafeRedirectPath('/blog/create', '/products', ORIGIN)).toBe('/blog/create');
    expect(getSafeRedirectPath('/products/123/edit?tab=images#hero', '/products', ORIGIN))
      .toBe('/products/123/edit?tab=images#hero');
  });

  it('rejects external, protocol-relative, and dangerous scheme redirects', () => {
    expect(getSafeRedirectPath('https://evil.example', '/products', ORIGIN)).toBe('/products');
    expect(getSafeRedirectPath('//evil.example/path', '/products', ORIGIN)).toBe('/products');
    expect(getSafeRedirectPath('javascript:alert(1)', '/products', ORIGIN)).toBe('/products');
    expect(getSafeRedirectPath('JavaScript:alert(1)', '/products', ORIGIN)).toBe('/products');
    expect(getSafeRedirectPath('data:text/html,evil', '/products', ORIGIN)).toBe('/products');
  });

  it('rejects backslash and encoded protocol-relative bypasses', () => {
    expect(getSafeRedirectPath('/\\evil.example', '/products', ORIGIN)).toBe('/products');
    expect(getSafeRedirectPath('\\\\evil.example', '/products', ORIGIN)).toBe('/products');
    expect(getSafeRedirectPath('%2F%2Fevil.example', '/products', ORIGIN)).toBe('/products');
    expect(getSafeRedirectPath('%5C%5Cevil.example', '/products', ORIGIN)).toBe('/products');
  });

  it('rejects whitespace and control character bypasses', () => {
    expect(getSafeRedirectPath('  //evil.example', '/products', ORIGIN)).toBe('/products');
    expect(getSafeRedirectPath('/blog/create ', '/products', ORIGIN)).toBe('/products');
    expect(getSafeRedirectPath('/blog/create\n', '/products', ORIGIN)).toBe('/products');
    expect(getSafeRedirectPath('/blog/create\u0000', '/products', ORIGIN)).toBe('/products');
  });

  it('rejects login-to-login redirect loops', () => {
    expect(getSafeRedirectPath('/users/login', '/products', ORIGIN)).toBe('/products');
    expect(getSafeRedirectPath('/users/login/', '/products', ORIGIN)).toBe('/products');
    expect(getSafeRedirectPath('/Users/Login', '/products', ORIGIN)).toBe('/products');
    expect(getSafeRedirectPath('/users/login?redirect=/blog/create', '/products', ORIGIN))
      .toBe('/products');
  });

  it('falls back for missing values or when no browser origin is available', () => {
    expect(getSafeRedirectPath(null, '/products', ORIGIN)).toBe('/products');
    expect(getSafeRedirectPath('', '/products', ORIGIN)).toBe('/products');
    expect(getSafeRedirectPath('/blog/create', '/products')).toBe('/products');
  });

  it('builds an encoded login URL from safe current paths', () => {
    expect(buildLoginRedirectUrl('/blog/create', '/products', ORIGIN))
      .toBe('/users/login?redirect=%2Fblog%2Fcreate');
    expect(buildLoginRedirectUrl('/products/123/edit?tab=images', '/products', ORIGIN))
      .toBe('/users/login?redirect=%2Fproducts%2F123%2Fedit%3Ftab%3Dimages');
  });

  it('falls back when building a login URL from unsafe paths', () => {
    expect(buildLoginRedirectUrl('//evil.example', '/products', ORIGIN))
      .toBe('/users/login?redirect=%2Fproducts');
  });
});
