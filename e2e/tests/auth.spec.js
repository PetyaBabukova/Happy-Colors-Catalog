import { expect, test } from '@playwright/test';
import {
  englishLocaleEnabled,
  localeRoutesEnabled,
  pathEndPattern,
} from './helpers/shop.js';

const ownerEmail = 'owner.e2e@example.com';
const ownerPassword = process.env.E2E_OWNER_PASSWORD || 'E2ePass123!';

test.describe('owner session', () => {
  test.use({ storageState: 'e2e/.auth/owner.json' });

  test('reuses seeded owner auth state @critical @auth', async ({ request }) => {
    const response = await request.get('/api/users/me');

    await expect(response).toBeOK();

    const user = await response.json();

    expect(user).toMatchObject({
      username: 'e2e-owner',
      email: ownerEmail,
    });
  });

  test('logs out and clears the browser session @critical @auth', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('e2e-owner')).toBeVisible();

    await page.goto('/users/logout');
    const postLogoutUrlPattern = !localeRoutesEnabled
      ? pathEndPattern('/')
      : englishLocaleEnabled
        ? /\/(?:bg|en)\/?(?:[?#].*)?$/
        : pathEndPattern('/bg');
    await expect(page).toHaveURL(postLogoutUrlPattern);
    await expect(page.getByText('e2e-owner')).toHaveCount(0);

    const response = await page.request.get('/api/users/me');
    expect(response.status()).toBe(401);
  });
});

test.describe('login form', () => {
  test('logs in with the seeded owner credentials @critical @auth', async ({ page }) => {
    test.skip(!localeRoutesEnabled, 'Localized post-login redirect requires locale routing to be enabled.');

    await page.goto('/users/login');

    await page.getByLabel('E-mail').fill(ownerEmail);
    await page.getByLabel('Password').fill(ownerPassword);
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page).toHaveURL(/\/bg\/products$/);
    await expect(page.getByText('e2e-owner')).toBeVisible();

    const response = await page.request.get('/api/users/me');
    await expect(response).toBeOK();

    const user = await response.json();
    expect(user).toMatchObject({
      username: 'e2e-owner',
      email: ownerEmail,
    });
  });

  test('rejects invalid credentials without creating a session @critical @auth', async ({ page }) => {
    await page.goto('/users/login');

    await page.getByLabel('E-mail').fill(ownerEmail);
    await page.getByLabel('Password').fill('definitely-not-the-owner-password');

    const loginResponse = page.waitForResponse(
      (response) => response.url().includes('/api/users/login') && response.status() === 401
    );
    await page.getByRole('button', { name: 'Login' }).click();
    await loginResponse;

    await expect(page).toHaveURL(/\/users\/login$/);
    await expect(page.getByText('e2e-owner')).toHaveCount(0);

    const meResponse = await page.request.get('/api/users/me');
    expect(meResponse.status()).toBe(401);
  });
});
