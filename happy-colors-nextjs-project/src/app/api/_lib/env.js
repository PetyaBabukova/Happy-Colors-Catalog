import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

let envLoaded = false;

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

  for (const envPath of resolveEnvCandidates()) {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath, override: false });
    }
  }

  envLoaded = true;
}
