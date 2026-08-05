import { expect, test } from '@playwright/test';
import {
  englishLocaleEnabled,
  localeRoutesEnabled,
  pathEndPattern,
} from './helpers/shop.js';

test.describe('Bulgarian-first location behavior', () => {
  test.use({ locale: 'en-US' });

  test('defaults an unknown location to Bulgarian despite an English browser @critical @localized', async ({
    page,
  }) => {
    test.skip(
      !localeRoutesEnabled || !englishLocaleEnabled,
      'Locale negotiation requires localized routes and English to be enabled.'
    );

    await page.goto('/');

    await expect(page).toHaveURL(pathEndPattern('/bg'));
    await expect(page.getByLabel('Език: BG')).toBeVisible();
  });

  test('uses Bulgarian for a confirmed Bulgarian location @critical @localized', async ({
    page,
  }) => {
    test.skip(
      !localeRoutesEnabled || !englishLocaleEnabled,
      'Locale selection requires localized routes and English to be enabled.'
    );
    await page.setExtraHTTPHeaders({ 'CF-IPCountry': 'BG' });

    await page.goto('/');

    await expect(page).toHaveURL(pathEndPattern('/bg'));
    await expect(page.getByLabel('Език: BG')).toBeVisible();
  });
});

test.describe('public locale negotiation and switching', () => {
  test.use({ locale: 'en-US' });

  test.beforeEach(() => {
    test.skip(
      !localeRoutesEnabled || !englishLocaleEnabled,
      'Locale negotiation requires localized routes and English to be enabled.'
    );
  });

  test('uses English for a confirmed non-Bulgarian location @critical @localized', async ({
    page,
  }) => {
    await page.setExtraHTTPHeaders({ 'CF-IPCountry': 'DE' });
    await page.goto('/');

    await expect(page).toHaveURL(pathEndPattern('/en'));
    await expect(page.getByLabel('Language: EN')).toBeVisible();
  });

  test('persists a manual language choice and preserves safe query state @critical @localized', async ({
    context,
    page,
  }) => {
    await page.goto('/bg/search?q=E2E');

    await page.getByLabel('Език: BG').click();
    await page.getByRole('link', { name: 'EN — English' }).click();

    await expect(page).toHaveURL(/\/en\/search\?q=E2E$/);
    await expect(page.getByLabel('Language: EN')).toBeVisible();

    const localeCookie = (await context.cookies()).find(
      ({ name }) => name === 'happycolors_locale'
    );
    expect(localeCookie?.value).toBe('en');

    await page.goto('/');
    await expect(page).toHaveURL(pathEndPattern('/en'));
  });

  test('keeps an explicit localized URL authoritative over a conflicting cookie @critical @localized', async ({
    page,
  }) => {
    await page.goto('/en');
    await page.getByLabel('Language: EN').click();
    await page.getByRole('link', { name: 'BG — Български' }).click();
    await expect(page).toHaveURL(pathEndPattern('/bg'));

    await page.goto('/en/products');

    await expect(page).toHaveURL(pathEndPattern('/en/products'));
    await expect(page.getByLabel('Language: EN')).toBeVisible();
  });
});
