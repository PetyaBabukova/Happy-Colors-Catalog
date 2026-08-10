import { describe, expect, it } from 'vitest';

import {
  ARTIST_STATUSES,
  USER_ROLES,
  canArtistManageProducts,
  isActiveArtist,
  isFullAdmin,
  normalizeArtistStatus,
  normalizeRole,
  serializeUser,
} from '../../../../shared/authRoles.js';

describe('shared auth role helpers', () => {
  it('normalizes roles and artist statuses', () => {
    expect(normalizeRole(USER_ROLES.FULL_ADMIN)).toBe(USER_ROLES.FULL_ADMIN);
    expect(normalizeRole('unknown')).toBe(USER_ROLES.CUSTOMER);

    expect(normalizeArtistStatus(USER_ROLES.CUSTOMER, ARTIST_STATUSES.ACTIVE)).toBeNull();
    expect(normalizeArtistStatus(USER_ROLES.ARTIST, ARTIST_STATUSES.ACTIVE)).toBe(ARTIST_STATUSES.ACTIVE);
    expect(normalizeArtistStatus(USER_ROLES.ARTIST, 'unknown')).toBe(ARTIST_STATUSES.PENDING);
  });

  it('serializes users with canonical role and artist status values', () => {
    expect(serializeUser(null)).toBeNull();
    expect(serializeUser({
      _id: 123,
      username: 'artist',
      email: 'artist@example.com',
      role: USER_ROLES.ARTIST,
      artistStatus: 'unknown',
    })).toEqual({
      _id: '123',
      username: 'artist',
      email: 'artist@example.com',
      role: USER_ROLES.ARTIST,
      artistStatus: ARTIST_STATUSES.PENDING,
    });
  });

  it('classifies admin and artist product permissions', () => {
    expect(isFullAdmin({ role: USER_ROLES.FULL_ADMIN })).toBe(true);
    expect(isActiveArtist({
      role: USER_ROLES.ARTIST,
      artistStatus: ARTIST_STATUSES.ACTIVE,
    })).toBe(true);
    expect(canArtistManageProducts({
      role: USER_ROLES.ARTIST,
      artistStatus: ARTIST_STATUSES.PENDING,
    })).toBe(true);
    expect(canArtistManageProducts({
      role: USER_ROLES.ARTIST,
      artistStatus: ARTIST_STATUSES.SUSPENDED,
    })).toBe(false);
  });
});
