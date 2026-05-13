import { expect, test } from '@playwright/test';

test('products listing loads seeded product @smoke @products', async ({ page }) => {
  await page.goto('/products');

  await expect(page.locator('body')).not.toContainText('Application error');
  await expect(page.getByText('E2E Smoke Product')).toBeVisible();
});

test('product details load from listing @smoke @products', async ({ page }) => {
  await page.goto('/products');

  await page.getByRole('link', { name: /E2E Smoke Product/ }).first().click();

  await expect(page).toHaveURL(/\/products\/[a-f0-9]{24}$/);
  await expect(page.getByRole('heading', { name: /E2E Smoke Product/ })).toBeVisible();
  await expect(page.getByText('Seeded product for Playwright smoke tests.')).toBeVisible();
});

test.describe('owner product controls', () => {
  test.use({ storageState: 'e2e/.auth/owner.json' });

  test('shows edit and delete links for the seeded product owner @critical @products @auth', async ({
    page,
  }) => {
    await page.goto('/products');
    await page.getByRole('link', { name: /E2E Smoke Product/ }).first().click();

    await expect(page.getByRole('heading', { name: /E2E Smoke Product/ })).toBeVisible();
    await expect(page.locator('a[href$="/edit"]')).toBeVisible();
    await expect(page.locator('a[href$="/delete"]')).toBeVisible();
  });
});
