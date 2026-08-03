import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

let envLoaded = false;
const TEST_ENV_LOADED_MARKER = 'HAPPY_COLORS_TEST_ENV_LOADED';

function resolveEnvCandidates() {
  const projectRoot = process.cwd();

  return [
    path.join(projectRoot, '.env.local'),
    path.join(projectRoot, '.env'),
    path.join(projectRoot, '..', 'server', '.env'),
    path.join(projectRoot, '..', '.env'),
  ];
}

export function ensureServerEnvLoaded() {
  if (envLoaded) {
    return;
  }

  if (process.env[TEST_ENV_LOADED_MARKER] === 'true') {
    envLoaded = true;
    return;
  }

  for (const envPath of resolveEnvCandidates()) {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath, override: false });
    }
  }

  envLoaded = true;
}
