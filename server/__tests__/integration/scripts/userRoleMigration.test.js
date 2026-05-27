import { describe, expect, it } from 'vitest';
import User from '../../../models/User.js';
import { ARTIST_STATUSES, USER_ROLES } from '../../../utils/userRoles.js';
import { backfillUserRoles } from '../../../../scripts/backfillUserRoles.js';
import { promoteFullAdmins } from '../../../../scripts/promoteFullAdmins.js';
import { createUser } from '../factories.js';

describe('user role migration scripts', () => {
  it('defaults existing non-owner users to customer and promotes configured owners', async () => {
    const owner = await createUser({ email: 'owner@example.com', role: undefined });
    const legacy = await createUser({ email: 'legacy@example.com', role: undefined });
    const artist = await createUser({
      email: 'artist@example.com',
      role: USER_ROLES.ARTIST,
      artistStatus: ARTIST_STATUSES.ACTIVE,
    });
    const accidentalStatus = await createUser({
      email: 'status@example.com',
      role: USER_ROLES.CUSTOMER,
      artistStatus: ARTIST_STATUSES.SUSPENDED,
    });

    await backfillUserRoles({ ownerEmails: [' OWNER@example.com '] });
    await backfillUserRoles({ ownerEmails: ['owner@example.com'] });

    await expect(User.findById(owner._id).lean()).resolves.toMatchObject({
      role: USER_ROLES.FULL_ADMIN,
    });
    await expect(User.findById(legacy._id).lean()).resolves.toMatchObject({
      role: USER_ROLES.CUSTOMER,
    });
    await expect(User.findById(artist._id).lean()).resolves.toMatchObject({
      role: USER_ROLES.ARTIST,
      artistStatus: ARTIST_STATUSES.ACTIVE,
    });

    const cleanedStatus = await User.findById(accidentalStatus._id).lean();
    expect(cleanedStatus.role).toBe(USER_ROLES.CUSTOMER);
    expect(cleanedStatus).not.toHaveProperty('artistStatus');
  });

  it('fails when a configured owner email does not exist', async () => {
    await expect(backfillUserRoles({ ownerEmails: ['missing@example.com'] })).rejects.toThrow(
      'Owner account email not found'
    );
  });

  it('promotes full admins through the dedicated script', async () => {
    const owner = await createUser({ email: 'admin@example.com' });

    const result = await promoteFullAdmins({ ownerEmails: ['admin@example.com'] });

    expect(result.ownersMatched).toBe(1);
    await expect(User.findById(owner._id).lean()).resolves.toMatchObject({
      role: USER_ROLES.FULL_ADMIN,
    });
  });
});
