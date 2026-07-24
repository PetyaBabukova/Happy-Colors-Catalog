import { expect, test } from '@playwright/test';
import {
  defaultCatalogPath,
  englishCatalogPath,
  englishLocaleEnabled,
  localeRoutesEnabled,
} from './helpers/shop.js';

test('products listing loads seeded product @smoke @products', async ({ page }) => {
  test.skip(!localeRoutesEnabled, 'Localized routes require locale routing to be enabled.');

  await page.goto(defaultCatalogPath);

  await expect(page.locator('body')).not.toContainText('Application error');
  await expect(page.getByText('E2E Smoke Product')).toBeVisible();
});

test('English products listing shows seeded product as explicit fallback @smoke @products @localized', async ({ page }) => {
  test.skip(
    !localeRoutesEnabled || !englishLocaleEnabled,
    'English localized catalog requires locale routing and English to be enabled.'
  );

  await page.goto(englishCatalogPath);

  await expect(page.locator('body')).not.toContainText('Application error');
  await expect(page.getByText('E2E Smoke Product')).toBeVisible();
  await expect(page.getByText('Translation pending')).toBeVisible();
});

test('Bulgarian product details load from listing @smoke @products @localized', async ({ page }) => {
  test.skip(!localeRoutesEnabled, 'Localized product details require locale routing to be enabled.');

  await page.goto(defaultCatalogPath);

  await page.getByRole('link', { name: /E2E Smoke Product/ }).first().click();

  await expect(page).toHaveURL(/\/bg\/products\/[a-f0-9]{24}$/);
  await expect(page.getByRole('heading', { name: /E2E Smoke Product/ })).toBeVisible();
  await expect(page.getByText('Seeded product for Playwright smoke tests.')).toBeVisible();
});

test('English product details show seeded product as explicit fallback @smoke @products @localized', async ({ page }) => {
  test.skip(
    !localeRoutesEnabled || !englishLocaleEnabled,
    'English localized product details require locale routing and English to be enabled.'
  );

  await page.goto(englishCatalogPath);
  await page.getByRole('link', { name: /E2E Smoke Product/ }).first().click();

  await expect(page).toHaveURL(/\/en\/products\/[a-f0-9]{24}$/);
  await expect(page.getByRole('heading', { name: /E2E Smoke Product/ })).toBeVisible();
  await expect(page.getByText('Translation pending')).toBeVisible();
});

test.describe('owner product controls', () => {
  test.use({ storageState: 'e2e/.auth/owner.json' });

  test('shows edit and delete links for the seeded product owner @critical @products @auth', async ({
    page,
  }) => {
    test.skip(!localeRoutesEnabled, 'Localized routes require locale routing to be enabled.');

    await page.goto(defaultCatalogPath);
    await page.getByRole('link', { name: /E2E Smoke Product/ }).first().click();

    await expect(page.getByRole('heading', { name: /E2E Smoke Product/ })).toBeVisible();
    await expect(page.locator('a[href$="/edit"]')).toBeVisible();
    await expect(page.locator('a[href$="/delete"]')).toBeVisible();
  });
});
