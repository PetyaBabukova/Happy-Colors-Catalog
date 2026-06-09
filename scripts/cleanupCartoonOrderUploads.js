import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from '../server/mongoose.js';
import { cleanupUnclaimedCartoonOrderUploads } from '../server/services/cartoonOrdersService.js';

const DEFAULT_UNCLAIMED_UPLOAD_RETENTION_DAYS = 14;
const MIN_UNCLAIMED_UPLOAD_RETENTION_DAYS = 1;

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

export async function cleanupCartoonOrderUploadsFromEnv({ loadEnv = loadCleanupEnv } = {}) {
  loadEnv();

  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required.');
  }

  if (!hasCleanupStorageEnv()) {
    throw new Error('Cartoon order storage bucket is required.');
  }

  await mongoose.connect(process.env.MONGO_URI);

  try {
    const result = await cleanupUnclaimedCartoonOrderUploads({
      retentionDays: parsePositiveNumber(
        process.env.CARTOON_UPLOAD_CLEANUP_RETENTION_DAYS,
        DEFAULT_UNCLAIMED_UPLOAD_RETENTION_DAYS,
        { min: MIN_UNCLAIMED_UPLOAD_RETENTION_DAYS }
      ),
      limit: parsePositiveNumber(process.env.CARTOON_UPLOAD_CLEANUP_LIMIT, 200),
    });

    return {
      cutoff: result.cutoff.toISOString(),
      scannedSessions: result.scannedSessions,
      candidateCount: result.candidateCount,
      deletedCount: result.deletedCount,
      preservedOrderLinkedCount: result.preservedOrderLinkedCount,
      skippedLockedCount: result.skippedLockedCount,
      skippedUnsafeCount: result.skippedUnsafeCount,
      failedCount: result.failedCount,
    };
  } finally {
    await mongoose.disconnect();
  }
}

export async function runCleanupCartoonOrderUploadsCli({
  stdout = console.log,
  stderr = console.error,
} = {}) {
  try {
    const result = await cleanupCartoonOrderUploadsFromEnv();

    stdout(JSON.stringify(result, null, 2));

    return result.failedCount > 0 ? 1 : 0;
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
