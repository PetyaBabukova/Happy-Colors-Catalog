import 'dotenv/config';
import { fileURLToPath } from 'url';
import mongoose from '../server/mongoose.js';
import { backfillUserRoles, parseEmailList } from './backfillUserRoles.js';

export async function promoteFullAdmins({ ownerEmails = [] } = {}) {
  const result = await backfillUserRoles({ ownerEmails });

  return {
    ownerEmails: result.normalizedOwnerEmails,
    ownersMatched: result.ownersMatched,
    ownersModified: result.ownersModified,
  };
}

async function runFromCli() {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error('MONGO_URI is required.');
  }

  const ownerEmails = parseEmailList(process.argv.slice(2).join(',') || process.env.FULL_ADMIN_EMAILS);

  if (ownerEmails.length === 0) {
    throw new Error('At least one owner email is required.');
  }

  await mongoose.connect(mongoUri);
  const result = await promoteFullAdmins({ ownerEmails });

  console.log(`Full admin promotion complete. Owners matched: ${result.ownersMatched}. Owners updated: ${result.ownersModified}.`);
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
