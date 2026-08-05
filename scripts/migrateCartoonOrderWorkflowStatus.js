import { fileURLToPath } from 'node:url';
import mongoose from '../server/mongoose.js';
import CartoonOrder from '../server/models/CartoonOrder.js';
import { loadMigrationEnv } from './migrateProductGalleryFlags.js';

const __filename = fileURLToPath(import.meta.url);

const MISSING_WORKFLOW_FILTER = { workflowStatus: { $exists: false } };
const COMPLETED_CANDIDATE_FILTER = {
  ...MISSING_WORKFLOW_FILTER,
  completedAt: { $type: 'date' },
};
const ARCHIVED_REVIEW_FILTER = {
  ...MISSING_WORKFLOW_FILTER,
  completedAt: null,
  archivedAt: { $type: 'date' },
};
const INQUIRY_CANDIDATE_FILTER = {
  ...MISSING_WORKFLOW_FILTER,
  completedAt: null,
  archivedAt: null,
};

export async function migrateCartoonOrderWorkflowStatus({
  dryRun = false,
  CartoonOrderModel = CartoonOrder,
} = {}) {
  const [missing, completedCandidates, inquiryCandidates, archivedNeedsReview] =
    await Promise.all([
      CartoonOrderModel.countDocuments(MISSING_WORKFLOW_FILTER),
      CartoonOrderModel.countDocuments(COMPLETED_CANDIDATE_FILTER),
      CartoonOrderModel.countDocuments(INQUIRY_CANDIDATE_FILTER),
      CartoonOrderModel.countDocuments(ARCHIVED_REVIEW_FILTER),
    ]);

  if (dryRun) {
    return {
      dryRun: true,
      missing,
      completedCandidates,
      inquiryCandidates,
      archivedNeedsReview,
      updatedCompleted: 0,
      updatedInquiry: 0,
    };
  }

  const [completedResult, inquiryResult] = await Promise.all([
    CartoonOrderModel.updateMany(COMPLETED_CANDIDATE_FILTER, {
      $set: { workflowStatus: 'completed' },
    }),
    CartoonOrderModel.updateMany(INQUIRY_CANDIDATE_FILTER, {
      $set: { workflowStatus: 'inquiry' },
    }),
  ]);

  return {
    dryRun: false,
    missing,
    completedCandidates,
    inquiryCandidates,
    archivedNeedsReview,
    updatedCompleted: completedResult.modifiedCount ?? completedResult.nModified ?? 0,
    updatedInquiry: inquiryResult.modifiedCount ?? inquiryResult.nModified ?? 0,
  };
}

export async function runMigrationFromEnv({ dryRun = false, loadEnv = loadMigrationEnv } = {}) {
  loadEnv();

  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required.');
  }

  await mongoose.connect(process.env.MONGO_URI);

  try {
    return await migrateCartoonOrderWorkflowStatus({ dryRun });
  } finally {
    await mongoose.disconnect();
  }
}

export async function runMigrationCli({
  argv = process.argv.slice(2),
  stdout = console.log,
  stderr = console.error,
} = {}) {
  const dryRun = argv.includes('--dry-run');

  try {
    const result = await runMigrationFromEnv({ dryRun });

    stdout(JSON.stringify(result, null, 2));

    return 0;
  } catch (error) {
    stderr(error?.message || error);

    return 1;
  }
}

if (__filename === process.argv[1]) {
  runMigrationCli().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
