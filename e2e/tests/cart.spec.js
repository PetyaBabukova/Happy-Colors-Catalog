import { expect, test } from '@playwright/test';

const catalogMode =
  process.env.NEXT_PUBLIC_CATALOG_MODE === 'true' || process.env.CATALOG_MODE === 'true';

async function addSeededProductToCart(page) {
  await page.goto('/products');
  await page.getByRole('link', { name: /E2E Smoke Product/ }).first().click();
  await expect(page.getByRole('heading', { name: /E2E Smoke Product/ })).toBeVisible();

  await page.getByTestId('add-to-cart-button').click();

  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByTestId('cart-item')).toContainText('E2E Smoke Product');
}

test('cart flow works or redirects safely in catalog mode @smoke @cart', async ({ page }) => {
  await page.goto('/cart');
  await expect(page.locator('body')).not.toContainText('Application error');

  if (catalogMode) {
    await expect(page).toHaveURL(/\/products$/);
    await expect(page.getByText('E2E Smoke Product')).toBeVisible();
    return;
  }

  await expect(page).toHaveURL(/\/cart$/);

  await addSeededProductToCart(page);
});

test.describe('cart regression', () => {
  test.skip(catalogMode, 'Cart mutations are disabled in catalog mode.');

  test('updates quantity and persists after reload @critical @cart @catalog-mode-sensitive', async ({
    page,
  }) => {
    await addSeededProductToCart(page);

    await expect(page.getByTestId('cart-quantity')).toHaveText('1');

    await page.getByTestId('cart-increase').click();
    await expect(page.getByTestId('cart-quantity')).toHaveText('2');

    await page.reload();
    await expect(page.getByTestId('cart-item')).toContainText('E2E Smoke Product');
    await expect(page.getByTestId('cart-quantity')).toHaveText('2');

    await page.getByTestId('cart-decrease').click();
    await expect(page.getByTestId('cart-quantity')).toHaveText('1');
  });

  test('removes an item and exposes the empty-cart state @critical @cart @catalog-mode-sensitive', async ({
    page,
  }) => {
    await addSeededProductToCart(page);

    await page.getByTestId('cart-remove').click();

    await expect(page.getByTestId('cart-item')).toHaveCount(0);
    await expect(page.getByTestId('empty-cart')).toBeVisible();
  });
});
