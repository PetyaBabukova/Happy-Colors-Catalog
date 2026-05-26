import { describe, expect, it } from 'vitest';
import {
  canCreateProduct,
  canHardDeleteProduct,
  canManageProduct,
  canSoftDeleteProduct,
  canSubmitProductForReview,
  canViewProduct,
  canWithdrawProductReview,
} from '../../../utils/productPermissions.js';

const admin = { _id: 'admin-1', role: 'full_admin', artistStatus: null };
const artist = { _id: 'artist-1', role: 'artist', artistStatus: 'active' };
const otherArtist = { _id: 'artist-2', role: 'artist', artistStatus: 'active' };
const pendingArtist = { _id: 'artist-3', role: 'artist', artistStatus: 'pending' };
const suspendedArtist = { _id: 'artist-4', role: 'artist', artistStatus: 'suspended' };
const customer = { _id: 'customer-1', role: 'customer', artistStatus: null };

function product(overrides = {}) {
  return {
    _id: 'product-1',
    owner: 'artist-1',
    publicationStatus: 'draft',
    ...overrides,
  };
}

describe('product permission helpers', () => {
  it('allows full admins to view and manage every product', () => {
    const archived = product({ owner: 'artist-2', publicationStatus: 'archived' });

    expect(canViewProduct(archived, admin)).toBe(true);
    expect(canManageProduct(archived, admin)).toBe(true);
    expect(canHardDeleteProduct(archived, admin)).toBe(true);
    expect(canSoftDeleteProduct(product({ publicationStatus: 'deleted' }), admin)).toBe(false);
  });

  it('allows non-suspended artists to create and manage their own active products', () => {
    expect(canCreateProduct(artist)).toBe(true);
    expect(canCreateProduct(pendingArtist)).toBe(true);
    expect(canManageProduct(product({ publicationStatus: 'draft' }), artist)).toBe(true);
    expect(canManageProduct(product({ owner: 'artist-3', publicationStatus: 'draft' }), pendingArtist)).toBe(true);
    expect(canManageProduct(product({ publicationStatus: 'rejected' }), artist)).toBe(true);
    expect(canManageProduct(product({ publicationStatus: 'pending_review' }), artist)).toBe(true);
    expect(canManageProduct(product({ publicationStatus: 'published' }), artist)).toBe(true);
    expect(canManageProduct(product({ publicationStatus: 'archived' }), artist)).toBe(false);
    expect(canManageProduct(product({ publicationStatus: 'deleted' }), artist)).toBe(false);
    expect(canManageProduct(product({ owner: 'artist-2' }), artist)).toBe(false);
    expect(canSoftDeleteProduct(product({ publicationStatus: 'published' }), artist)).toBe(true);
    expect(canSoftDeleteProduct(product({ publicationStatus: 'archived' }), artist)).toBe(false);
    expect(canSoftDeleteProduct(product({ owner: 'artist-2', publicationStatus: 'published' }), artist)).toBe(false);
  });

  it('blocks customers and suspended artists from product mutations', () => {
    expect(canCreateProduct(customer)).toBe(false);
    expect(canCreateProduct(suspendedArtist)).toBe(false);
    expect(canManageProduct(product(), suspendedArtist)).toBe(false);
    expect(canHardDeleteProduct(product(), customer)).toBe(false);
  });

  it('keeps public visibility separate from management visibility', () => {
    expect(canViewProduct(product({ publicationStatus: 'published' }), null)).toBe(true);
    expect(canViewProduct(product({ publicationStatus: 'draft' }), null)).toBe(false);
    expect(canViewProduct(product({ publicationStatus: 'draft' }), artist)).toBe(true);
    expect(canViewProduct(product({ publicationStatus: 'draft' }), otherArtist)).toBe(false);
  });

  it('allows artist review transitions only for own eligible products', () => {
    expect(canSubmitProductForReview(product({ publicationStatus: 'draft' }), artist)).toBe(true);
    expect(canSubmitProductForReview(product({ publicationStatus: 'rejected' }), artist)).toBe(true);
    expect(canSubmitProductForReview(product({ publicationStatus: 'pending_review' }), artist)).toBe(true);
    expect(canSubmitProductForReview(product({ publicationStatus: 'published' }), artist)).toBe(true);
    expect(canWithdrawProductReview(product({ publicationStatus: 'pending_review' }), artist)).toBe(true);
    expect(canWithdrawProductReview(product({ publicationStatus: 'pending_review' }), otherArtist)).toBe(false);
  });
});
