import { expect, test } from '@playwright/test';

const catalogMode =
  process.env.NEXT_PUBLIC_CATALOG_MODE === 'true' || process.env.CATALOG_MODE === 'true';

test('cart flow works or redirects safely in catalog mode @smoke @cart', async ({ page }) => {
  await page.goto('/cart');

  await expect(page.locator('body')).not.toContainText('Application error');

  if (catalogMode) {
    await expect(page).toHaveURL(/\/products$/);
    await expect(page.getByText('E2E Smoke Product')).toBeVisible();
    return;
  }

  await expect(page).toHaveURL(/\/cart$/);

  await page.goto('/products');
  await page.getByRole('link', { name: /E2E Smoke Product/ }).first().click();
  await expect(page.getByRole('heading', { name: /E2E Smoke Product/ })).toBeVisible();

  await page.getByTestId('add-to-cart-button').click();

  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByText('E2E Smoke Product')).toBeVisible();
});
