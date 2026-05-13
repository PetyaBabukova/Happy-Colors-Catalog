import { expect, test } from '@playwright/test';

test('homepage loads @smoke', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('body')).not.toContainText('Application error');
  await expect(page.locator('h1').first()).toBeVisible();
});

test('search handles seeded query @smoke @search', async ({ page }) => {
  await page.goto('/search?q=E2E');

  await expect(page.locator('body')).not.toContainText('Application error');
  await expect(page.getByText('E2E Smoke Product')).toBeVisible();
});
