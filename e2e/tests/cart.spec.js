import { expect, test } from '@playwright/test';

const catalogMode =
  process.env.NEXT_PUBLIC_CATALOG_MODE === 'true' || process.env.CATALOG_MODE === 'true';

test('cart route opens or redirects safely in catalog mode @smoke @cart', async ({ page }) => {
  await page.goto('/cart');

  await expect(page.locator('body')).not.toContainText('Application error');

  if (catalogMode) {
    await expect(page).toHaveURL(/\/products$/);
  } else {
    await expect(page).toHaveURL(/\/cart$/);
  }

  await expect(page.locator('main, body').first()).toBeVisible();
});
