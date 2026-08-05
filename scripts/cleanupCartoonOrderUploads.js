import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from '../server/mongoose.js';
import {
  cleanupUnclaimedCartoonOrderUploads,
  expireStalePersistentGuardReservations,
  reapClaimedOrphanCartoonOrderUploads,
  reconcileUploadByteGaugeCounters,
  sweepRecordlessCartoonOrderPhotoObjects,
} from '../server/services/cartoonOrdersService.js';

const DEFAULT_UNCLAIMED_UPLOAD_RETENTION_DAYS = 1;
const MIN_UNCLAIMED_UPLOAD_RETENTION_DAYS = 1;
const CLEANUP_MODES = new Set(['daily', 'weekly-recordless', 'all']);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getCleanupEnvCandidates({
  repoRoot = path.resolve(__dirname, '..'),
  isTest = process.env.NODE_ENV === 'test',
} = {}) {
  return isTest
    ? [path.resolve(repoRoot, '.env.test')]
    : [
        path.resolve(repoRoot, '.env'),
        path.resolve(repoRoot, 'server/.env'),
        path.resolve(repoRoot, '../Happy-Colors-SECRETS/.env'),
      ];
}

export function loadCleanupEnv({
  fileExists = fs.existsSync,
  readFile = (filePath) => fs.readFileSync(filePath),
  parseEnv = (content) => dotenv.parse(content),
} = {}) {
  if (hasRequiredCleanupEnv()) {
    return;
  }

  const repoRoot = path.resolve(__dirname, '..');
  const envCandidates = getCleanupEnvCandidates({ repoRoot });

  for (const envPath of envCandidates) {
    if (!fileExists(envPath)) {
      continue;
    }

    const parsedEnv = parseEnv(readFile(envPath));

    if (hasRequiredCleanupEnv(parsedEnv)) {
      applyEnv(parsedEnv);
      return;
    }
  }
}

function parsePositiveNumber(value, fallback, { min = 0 } = {}) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return fallback;
  }

  return Math.max(number, min);
}

function hasCleanupStorageEnv(env = process.env) {
  const nodeEnv = String(env.NODE_ENV || '');

  return Boolean(
    env.GCS_CARTOON_ORDERS_BUCKET_NAME ||
      ((nodeEnv === 'development' || nodeEnv === 'test') && env.GCS_BUCKET_NAME)
  );
}

function hasRequiredCleanupEnv(env = process.env) {
  return Boolean(env.MONGO_URI && hasCleanupStorageEnv(env));
}

function applyEnv(env) {
  for (const [key, value] of Object.entries(env)) {
    process.env[key] = value;
  }
}

function parseBooleanEnv(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function normalizeCleanupMode(value) {
  const mode = String(value || '').trim().toLowerCase();

  return CLEANUP_MODES.has(mode) ? mode : '';
}

function getCleanupMode({ mode = null } = {}) {
  const explicitMode = normalizeCleanupMode(mode);

  if (explicitMode) {
    return explicitMode;
  }

  if (mode) {
    throw new Error('Invalid CARTOON_UPLOAD_CLEANUP_MODE.');
  }

  const envMode = normalizeCleanupMode(process.env.CARTOON_UPLOAD_CLEANUP_MODE);

  if (envMode) {
    return envMode;
  }

  if (process.env.CARTOON_UPLOAD_CLEANUP_MODE) {
    throw new Error('Invalid CARTOON_UPLOAD_CLEANUP_MODE.');
  }

  return parseBooleanEnv(process.env.CARTOON_UPLOAD_RECORDLESS_SWEEP_ENABLED)
    ? 'all'
    : 'daily';
}

function parseCliMode(argv = []) {
  const modeFlag = argv.find((arg) => String(arg).startsWith('--mode='));

  return modeFlag ? String(modeFlag).slice('--mode='.length) : '';
}

export async function cleanupCartoonOrderUploadsFromEnv({
  loadEnv = loadCleanupEnv,
  mode = null,
} = {}) {
  loadEnv();

  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required.');
  }

  if (!hasCleanupStorageEnv()) {
    throw new Error('Cartoon order storage bucket is required.');
  }

  const cleanupMode = getCleanupMode({ mode });

  await mongoose.connect(process.env.MONGO_URI);

  try {
    const shouldRunDaily = cleanupMode === 'daily' || cleanupMode === 'all';
    const shouldRunRecordless = cleanupMode === 'weekly-recordless' || cleanupMode === 'all';
    const unclaimed = shouldRunDaily
      ? await cleanupUnclaimedCartoonOrderUploads({
          retentionDays: parsePositiveNumber(
            process.env.CARTOON_UPLOAD_CLEANUP_RETENTION_DAYS,
            DEFAULT_UNCLAIMED_UPLOAD_RETENTION_DAYS,
            { min: MIN_UNCLAIMED_UPLOAD_RETENTION_DAYS }
          ),
          limit: parsePositiveNumber(process.env.CARTOON_UPLOAD_CLEANUP_LIMIT, 200),
        })
      : null;
    const claimedOrphans = shouldRunDaily
      ? await reapClaimedOrphanCartoonOrderUploads({
          graceMinutes: parsePositiveNumber(
            process.env.CARTOON_UPLOAD_CLAIMED_ORPHAN_GRACE_MINUTES,
            60
          ),
          limit: parsePositiveNumber(process.env.CARTOON_UPLOAD_CLEANUP_LIMIT, 200),
        })
      : null;
    const recordlessSweep = shouldRunRecordless
      ? await sweepRecordlessCartoonOrderPhotoObjects({
          retentionDays: parsePositiveNumber(
            process.env.CARTOON_UPLOAD_RECORDLESS_SWEEP_RETENTION_DAYS,
            DEFAULT_UNCLAIMED_UPLOAD_RETENTION_DAYS,
            { min: MIN_UNCLAIMED_UPLOAD_RETENTION_DAYS }
          ),
          limit: parsePositiveNumber(process.env.CARTOON_UPLOAD_RECORDLESS_SWEEP_LIMIT, 1000),
        })
      : null;
    const staleReservationExpiry = shouldRunDaily
      ? await expireStalePersistentGuardReservations()
      : null;
    const byteGaugeReconciliation = shouldRunDaily
      ? await reconcileUploadByteGaugeCounters()
      : null;

    return {
      mode: cleanupMode,
      ...(unclaimed
        ? {
            unclaimed: {
              cutoff: unclaimed.cutoff.toISOString(),
              scannedSessions: unclaimed.scannedSessions,
              candidateCount: unclaimed.candidateCount,
              deletedCount: unclaimed.deletedCount,
              preservedOrderLinkedCount: unclaimed.preservedOrderLinkedCount,
              skippedLockedCount: unclaimed.skippedLockedCount,
              skippedUnsafeCount: unclaimed.skippedUnsafeCount,
              failedCount: unclaimed.failedCount,
            },
          }
        : {}),
      ...(claimedOrphans
        ? {
            claimedOrphans: {
              cutoff: claimedOrphans.cutoff.toISOString(),
              scannedSessions: claimedOrphans.scannedSessions,
              candidateCount: claimedOrphans.candidateCount,
              deletedCount: claimedOrphans.deletedCount,
              preservedOrderLinkedCount: claimedOrphans.preservedOrderLinkedCount,
              skippedLockedCount: claimedOrphans.skippedLockedCount,
              skippedUnsafeCount: claimedOrphans.skippedUnsafeCount,
              failedCount: claimedOrphans.failedCount,
            },
          }
        : {}),
      ...(recordlessSweep
        ? {
            recordlessSweep: {
              cutoff: recordlessSweep.cutoff.toISOString(),
              scannedObjectCount: recordlessSweep.scannedObjectCount,
              candidateCount: recordlessSweep.candidateCount,
              deletedCount: recordlessSweep.deletedCount,
              skippedReferencedCount: recordlessSweep.skippedReferencedCount,
              skippedUnsafeCount: recordlessSweep.skippedUnsafeCount,
              failedCount: recordlessSweep.failedCount,
              errorCategory: recordlessSweep.errorCategory,
            },
          }
        : {}),
      ...(byteGaugeReconciliation
        ? {
            byteGaugeReconciliation: {
              repairedCounterCount: byteGaugeReconciliation.repairedCounterCount,
              repairedBytes: byteGaugeReconciliation.repairedBytes,
              skippedMissingGuardCount: byteGaugeReconciliation.skippedMissingGuardCount,
              expectedCounterCount: byteGaugeReconciliation.expectedCounterCount,
            },
          }
        : {}),
      ...(staleReservationExpiry
        ? {
            staleReservationExpiry: {
              expiredCount: staleReservationExpiry.expiredCount,
              expiredAmount: staleReservationExpiry.expiredAmount,
              confirmedCount: staleReservationExpiry.confirmedCount,
              confirmedAmount: staleReservationExpiry.confirmedAmount,
            },
          }
        : {}),
    };
  } finally {
    await mongoose.disconnect();
  }
}

export async function runCleanupCartoonOrderUploadsCli({
  stdout = console.log,
  stderr = console.error,
  argv = process.argv.slice(2),
} = {}) {
  try {
    const result = await cleanupCartoonOrderUploadsFromEnv({
      mode: parseCliMode(argv),
    });

    stdout(JSON.stringify(result, null, 2));

    const failedCount = Number(result.unclaimed?.failedCount || 0) +
      Number(result.claimedOrphans?.failedCount || 0) +
      Number(result.recordlessSweep?.failedCount || 0);

    return failedCount > 0 ? 1 : 0;
  } catch (error) {
    stderr(error?.message || error);

    return 1;
  }
}

if (__filename === process.argv[1]) {
  runCleanupCartoonOrderUploadsCli().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
