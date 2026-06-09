import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from '../server/mongoose.js';
import Product from '../server/models/Product.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MISSING_CATALOG_FLAG_FILTER = { isInCatalog: { $exists: false } };

export function getMigrationEnvCandidates({
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

export function loadMigrationEnv({
  fileExists = fs.existsSync,
  readFile = (filePath) => fs.readFileSync(filePath),
  parseEnv = (content) => dotenv.parse(content),
} = {}) {
  if (process.env.MONGO_URI) {
    return;
  }

  const envCandidates = getMigrationEnvCandidates();

  for (const envPath of envCandidates) {
    if (!fileExists(envPath)) {
      continue;
    }

    const parsedEnv = parseEnv(readFile(envPath));

    if (parsedEnv.MONGO_URI) {
      for (const [key, value] of Object.entries(parsedEnv)) {
        process.env[key] = value;
      }
      return;
    }
  }
}

// Тестваемо ядро: сетва isInCatalog: true само на продукти без полето.
// Idempotent — повторно изпълнение не засяга вече мигрирани продукти.
export async function migrateProductGalleryFlags({ dryRun = false, ProductModel = Product } = {}) {
  const pending = await ProductModel.countDocuments(MISSING_CATALOG_FLAG_FILTER);

  if (dryRun) {
    return { dryRun: true, pending, updated: 0 };
  }

  const result = await ProductModel.updateMany(MISSING_CATALOG_FLAG_FILTER, {
    $set: { isInCatalog: true },
  });
  const updated = result.modifiedCount ?? result.nModified ?? 0;

  return { dryRun: false, pending, updated };
}

export async function runMigrationFromEnv({ dryRun = false, loadEnv = loadMigrationEnv } = {}) {
  loadEnv();

  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required.');
  }

  await mongoose.connect(process.env.MONGO_URI);

  try {
    return await migrateProductGalleryFlags({ dryRun });
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
