import 'dotenv/config';
import { fileURLToPath } from 'url';
import mongoose from '../server/mongoose.js';
import User from '../server/models/User.js';
import { USER_ROLES } from '../server/utils/userRoles.js';

export function parseEmailList(value = '') {
  return String(value)
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function backfillUserRoles({ ownerEmails = [] } = {}) {
  const normalizedOwnerEmails = [...new Set(ownerEmails.map((email) => String(email).trim().toLowerCase()).filter(Boolean))];

  if (normalizedOwnerEmails.length > 0) {
    const existingOwners = await User.find(
      { email: { $in: normalizedOwnerEmails } },
      { email: 1 }
    ).lean();
    const foundEmails = new Set(existingOwners.map((user) => user.email));
    const missingEmails = normalizedOwnerEmails.filter((email) => !foundEmails.has(email));

    if (missingEmails.length > 0) {
      throw new Error(`Owner account email not found: ${missingEmails.join(', ')}`);
    }
  }

  const customerResult = await User.updateMany(
    {
      $or: [
        { role: { $exists: false } },
        { role: { $nin: Object.values(USER_ROLES) } },
      ],
    },
    { $set: { role: USER_ROLES.CUSTOMER }, $unset: { artistStatus: '' } }
  );

  const nonArtistStatusResult = await User.updateMany(
    {
      role: { $ne: USER_ROLES.ARTIST },
      artistStatus: { $exists: true },
    },
    { $unset: { artistStatus: '' } }
  );

  const ownerResult =
    normalizedOwnerEmails.length > 0
      ? await User.updateMany(
          { email: { $in: normalizedOwnerEmails } },
          { $set: { role: USER_ROLES.FULL_ADMIN }, $unset: { artistStatus: '' } }
        )
      : { matchedCount: 0, modifiedCount: 0 };

  return {
    normalizedOwnerEmails,
    customersMatched: customerResult.matchedCount,
    customersModified: customerResult.modifiedCount,
    nonArtistStatusesMatched: nonArtistStatusResult.matchedCount,
    nonArtistStatusesModified: nonArtistStatusResult.modifiedCount,
    ownersMatched: ownerResult.matchedCount,
    ownersModified: ownerResult.modifiedCount,
  };
}

async function runFromCli() {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error('MONGO_URI is required.');
  }

  const ownerEmails = parseEmailList(process.argv.slice(2).join(',') || process.env.FULL_ADMIN_EMAILS);

  await mongoose.connect(mongoUri);
  const result = await backfillUserRoles({ ownerEmails });

  console.log(
    [
      `User role backfill complete.`,
      `Owners matched: ${result.ownersMatched}.`,
      `Customers updated: ${result.customersModified}.`,
      `Non-artist statuses cleared: ${result.nonArtistStatusesModified}.`,
    ].join(' ')
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runFromCli()
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect();
    });
}
