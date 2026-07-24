import dotenv from 'dotenv';
import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

dotenv.config({ path: path.resolve(repoRoot, '.env.test') });

const port = Number(process.env.PORT || 3100);
const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${port}`;
const catalogMode = process.env.CATALOG_MODE || 'false';
const publicCatalogMode = process.env.NEXT_PUBLIC_CATALOG_MODE || catalogMode;
const localeRoutesEnabled = process.env.NEXT_PUBLIC_LOCALE_ROUTES_ENABLED || 'true';
const englishLocaleEnabled = process.env.NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED || 'true';

process.env.CATALOG_MODE = catalogMode;
process.env.NEXT_PUBLIC_CATALOG_MODE = publicCatalogMode;
process.env.NEXT_PUBLIC_LOCALE_ROUTES_ENABLED = localeRoutesEnabled;
process.env.NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED = englishLocaleEnabled;

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
    baseURL,
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
  webServer: {
    command: 'npm run dev',
    cwd: repoRoot,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      CATALOG_MODE: catalogMode,
      NEXT_PUBLIC_CATALOG_MODE: publicCatalogMode,
      NEXT_PUBLIC_LOCALE_ROUTES_ENABLED: localeRoutesEnabled,
      NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED: englishLocaleEnabled,
      NEXT_PUBLIC_SITE_URL: baseURL,
      RENDER_EXTERNAL_URL: baseURL,
      CLIENT_URL: baseURL,
      ALLOWED_ORIGINS: baseURL,
      DISABLE_EMAIL_DELIVERY: 'true',
    },
  },
});
