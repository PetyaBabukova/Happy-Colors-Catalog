import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

import { loadTestEnv } from '../scripts/loadTestEnv.js';
import { buildE2eServerEnv, getE2eRuntimeSettings } from './runtime-env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

loadTestEnv();

const settings = getE2eRuntimeSettings(process.env);

Object.assign(process.env, buildE2eServerEnv(process.env, settings));

const webServer = process.env.E2E_MANAGED_SERVER === 'true'
  ? undefined
  : {
      command: 'node server.js',
      cwd: repoRoot,
      url: settings.baseURL,
      reuseExistingServer: false,
      timeout: 120_000,
      env: buildE2eServerEnv(process.env, settings),
    };

export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.js',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: settings.baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer,
});
