import { expect } from '@playwright/test';

export const catalogMode =
  process.env.NEXT_PUBLIC_CATALOG_MODE === 'true' || process.env.CATALOG_MODE === 'true';

export async function addSeededProductToCart(page) {
  await page.goto('/products');
  await page.getByRole('link', { name: /E2E Smoke Product/ }).first().click();
  await expect(page.getByRole('heading', { name: /E2E Smoke Product/ })).toBeVisible();

  await page.getByTestId('add-to-cart-button').click();

  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByTestId('cart-item')).toContainText('E2E Smoke Product');
}
