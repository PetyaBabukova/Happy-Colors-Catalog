import { describe, expect, it } from 'vitest';

import {
  canUserManageOwnedProduct,
  getProductOwnerId,
  getUserId,
  isProductOwner,
} from '../../../../shared/productOwnership.js';

describe('shared product ownership predicates', () => {
  it('normalizes product owner ids from plain and populated owner values', () => {
    const objectIdLike = {
      toString: () => 'user-1',
    };

    expect(getProductOwnerId({ owner: 'user-1' })).toBe('user-1');
    expect(getProductOwnerId({ owner: { _id: 123 } })).toBe('123');
    expect(getProductOwnerId({ owner: objectIdLike })).toBe('user-1');
    expect(getProductOwnerId({ owner: { _id: 0 } })).toBe('');
    expect(getProductOwnerId({ owner: {} })).toBe('');
    expect(getProductOwnerId(null)).toBe('');
  });

  it('normalizes user ids from plain and object values', () => {
    expect(getUserId('user-1')).toBe('user-1');
    expect(getUserId({ _id: 123 })).toBe('123');
    expect(getUserId(null)).toBe('');
  });

  it('matches owners only when both ids are present and equal after string conversion', () => {
    expect(isProductOwner({ owner: { _id: 42 } }, { _id: '42' })).toBe(true);
    expect(isProductOwner({ owner: 'user-1' }, 'user-2')).toBe(false);
    expect(isProductOwner({ owner: '' }, 'user-1')).toBe(false);
    expect(isProductOwner({ owner: 'user-1' }, '')).toBe(false);
    expect(isProductOwner({ owner: {} }, {})).toBe(false);
  });

  it('allows full admins or matching product owners to manage owned products', () => {
    expect(canUserManageOwnedProduct({ owner: 'artist-1' }, { _id: 'artist-1', role: 'artist' })).toBe(true);
    expect(canUserManageOwnedProduct({ owner: 'artist-1' }, { _id: 'admin-1', role: 'full_admin' })).toBe(true);
    expect(canUserManageOwnedProduct({ owner: 'artist-1' }, { _id: 'artist-2', role: 'artist' })).toBe(false);
    expect(canUserManageOwnedProduct(null, { _id: 'admin-1', role: 'full_admin' })).toBe(false);
    expect(canUserManageOwnedProduct({ owner: 'artist-1' }, null)).toBe(false);
  });
});
