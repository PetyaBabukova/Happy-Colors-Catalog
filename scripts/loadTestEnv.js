import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..');

export const TEST_ENV_FILE_PATH = path.join(repoRoot, '.env.test');
export const TEST_ENV_LOADED_MARKER = 'HAPPY_COLORS_TEST_ENV_LOADED';

export function loadTestEnv({
  environment = process.env,
  envFilePath = TEST_ENV_FILE_PATH,
  allowMissing = environment.CI === 'true',
  override = false,
} = {}) {
  if (!fs.existsSync(envFilePath)) {
    if (!allowMissing) {
      throw new Error(
        `Missing ${path.basename(envFilePath)}. Create it from .env.test.example before running tests.`
      );
    }

    environment.NODE_ENV = 'test';
    environment[TEST_ENV_LOADED_MARKER] = 'true';
    return { envFilePath, loadedKeys: [] };
  }

  const parsed = dotenv.parse(fs.readFileSync(envFilePath));

  for (const [key, value] of Object.entries(parsed)) {
    if (override || !Object.prototype.hasOwnProperty.call(environment, key)) {
      environment[key] = value;
    }
  }

  environment.NODE_ENV = 'test';
  environment[TEST_ENV_LOADED_MARKER] = 'true';

  return {
    envFilePath,
    loadedKeys: Object.keys(parsed),
  };
}
