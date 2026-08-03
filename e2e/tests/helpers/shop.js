import { expect } from '@playwright/test';

export const catalogMode =
  process.env.NEXT_PUBLIC_CATALOG_MODE === 'true' || process.env.CATALOG_MODE === 'true';
export const localeRoutesEnabled = process.env.NEXT_PUBLIC_LOCALE_ROUTES_ENABLED === 'true';
export const englishLocaleEnabled = process.env.NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED === 'true';

export const defaultCatalogPath = '/bg/products';
export const englishCatalogPath = '/en/products';

export function pathEndPattern(path) {
  const escapedPath = String(path).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  return new RegExp(`${escapedPath}\\/?(?:[?#].*)?$`);
}

export function getSeededProductCard(page) {
  return page
    .locator('a[href*="/products/"]')
    .filter({ hasText: 'E2E Smoke Product' })
    .first();
}

export async function addSeededProductToCart(page) {
  await page.goto(defaultCatalogPath);
  await page.getByRole('link', { name: /E2E Smoke Product/ }).first().click();
  await expect(page.getByRole('heading', { name: /E2E Smoke Product/ })).toBeVisible();

  await page.getByTestId('add-to-cart-button').click();

  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByTestId('cart-item')).toContainText('E2E Smoke Product');
}
