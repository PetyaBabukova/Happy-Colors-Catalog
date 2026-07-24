import { expect, test } from '@playwright/test';
import {
  defaultCatalogPath,
  englishCatalogPath,
  englishLocaleEnabled,
  localeRoutesEnabled,
  pathEndPattern,
} from './helpers/shop.js';

test('root and legacy catalog paths redirect to Bulgarian defaults @smoke @localized @redirects', async ({
  page,
}) => {
  test.skip(!localeRoutesEnabled, 'Localized redirects require locale routing to be enabled.');

  await page.goto('/');

  await expect(page).toHaveURL(pathEndPattern('/bg'));
  await expect(page.locator('body')).not.toContainText('Application error');

  await page.goto('/products');

  await expect(page).toHaveURL(pathEndPattern(defaultCatalogPath));
  await expect(page.getByText('E2E Smoke Product')).toBeVisible();
});

test('Bulgarian homepage loads @smoke @localized', async ({ page }) => {
  test.skip(!localeRoutesEnabled, 'Localized routes require locale routing to be enabled.');

  await page.goto('/bg');

  await expect(page.locator('body')).not.toContainText('Application error');
  await expect(page.locator('h1').first()).toBeVisible();
});

test('English homepage loads @smoke @localized', async ({ page }) => {
  test.skip(
    !localeRoutesEnabled || !englishLocaleEnabled,
    'English localized routes require locale routing and English to be enabled.'
  );

  await page.goto('/en');

  await expect(page.locator('body')).not.toContainText('Application error');
  await expect(page.locator('h1').first()).toBeVisible();
});

test('Bulgarian search handles seeded query @smoke @search @localized', async ({ page }) => {
  test.skip(!localeRoutesEnabled, 'Localized search requires locale routing to be enabled.');

  await page.goto('/bg/search?q=E2E');

  await expect(page.locator('body')).not.toContainText('Application error');
  await expect(page.getByText('E2E Smoke Product')).toBeVisible();
});

test('English search handles seeded query @smoke @search @localized', async ({ page }) => {
  test.skip(
    !localeRoutesEnabled || !englishLocaleEnabled,
    'English localized search requires locale routing and English to be enabled.'
  );

  await page.goto('/en/search?q=E2E');

  await expect(page.locator('body')).not.toContainText('Application error');
  await expect(page.getByText('E2E Smoke Product')).toBeVisible();
});

test('localized catalog routes load the seeded product @smoke @products @localized', async ({ page }) => {
  test.skip(
    !localeRoutesEnabled || !englishLocaleEnabled,
    'BG/EN localized catalog requires locale routing and English to be enabled.'
  );

  await page.goto(defaultCatalogPath);

  await expect(page.locator('body')).not.toContainText('Application error');
  await expect(page.getByText('E2E Smoke Product')).toBeVisible();

  await page.goto(englishCatalogPath);

  await expect(page.locator('body')).not.toContainText('Application error');
  await expect(page.getByText('E2E Smoke Product')).toBeVisible();
  await expect(page.getByText('Translation pending')).toBeVisible();
});
