import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  TEST_ENV_LOADED_MARKER,
  loadTestEnv,
} from '../../../../scripts/loadTestEnv.js';

const tempDirectories = [];

afterEach(() => {
  for (const tempDirectory of tempDirectories.splice(0)) {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
});

function createTestEnvFile(contents) {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'happy-colors-test-env-'));
  const envFilePath = path.join(tempDirectory, '.env.test');

  tempDirectories.push(tempDirectory);
  fs.writeFileSync(envFilePath, contents);

  return envFilePath;
}

describe('loadTestEnv', () => {
  it('loads the exact test env file without replacing explicit environment values', () => {
    const envFilePath = createTestEnvFile([
      'FROM_TEST_FILE=loaded',
      'EXPLICIT_VALUE=from-file',
      'NODE_ENV=production',
    ].join('\n'));
    const environment = {
      EXPLICIT_VALUE: 'from-shell',
    };

    const result = loadTestEnv({ environment, envFilePath });

    expect(result.envFilePath).toBe(envFilePath);
    expect(result.loadedKeys).toEqual(['FROM_TEST_FILE', 'EXPLICIT_VALUE', 'NODE_ENV']);
    expect(environment).toMatchObject({
      FROM_TEST_FILE: 'loaded',
      EXPLICIT_VALUE: 'from-shell',
      NODE_ENV: 'test',
      [TEST_ENV_LOADED_MARKER]: 'true',
    });
  });

  it('fails fast locally when the test env file is missing', () => {
    expect(() => loadTestEnv({
      environment: {},
      envFilePath: path.join(os.tmpdir(), 'missing-happy-colors-env.test'),
    })).toThrow(/Missing .*env\.test/);
  });

  it('allows CI-provided variables when no test env file exists', () => {
    const environment = { CI: 'true', MONGO_URI: 'mongodb://ci/test' };

    expect(loadTestEnv({
      environment,
      envFilePath: path.join(os.tmpdir(), 'missing-happy-colors-ci-env.test'),
    }).loadedKeys).toEqual([]);
    expect(environment).toMatchObject({
      CI: 'true',
      MONGO_URI: 'mongodb://ci/test',
      NODE_ENV: 'test',
      [TEST_ENV_LOADED_MARKER]: 'true',
    });
  });
});
