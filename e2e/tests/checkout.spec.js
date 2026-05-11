import { expect, test } from '@playwright/test';
import { addSeededProductToCart, catalogMode } from './helpers/shop.js';

async function openCheckoutWithSeededProduct(page) {
  await addSeededProductToCart(page);
  await page.getByTestId('checkout-link').click();

  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByTestId('checkout-form')).toBeVisible();
  await expect(page.getByText('E2E Smoke Product')).toBeVisible();
}

async function mockEcontOfficeLookup(page) {
  await page.route('**/api/offices/econt?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        offices: [{ id: 'e2e-econt-1', address: 'E2E Econt Office 1', isAps: false }],
      }),
    });
  });
}

async function mockSpeedyOfficeLookup(page) {
  await page.route('**/api/offices/speedy?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        offices: [{ id: 'e2e-speedy-1', address: 'E2E Speedy Office 1', isAps: false }],
      }),
    });
  });
}

async function fillCheckoutCustomerDetails(page, overrides = {}) {
  await page.locator('#name').fill(overrides.name ?? 'E2E Checkout Buyer');
  await page.locator('#phone').fill(overrides.phone ?? '+359888123456');
  await page.locator('#email').fill(overrides.email ?? 'checkout.e2e@example.com');
  await page.locator('#city').fill(overrides.city ?? 'Sofia');
}

test.describe('checkout regression', () => {
  test.skip(catalogMode, 'Checkout is disabled in catalog mode.');

  test('shows the empty checkout state when the cart is empty @critical @checkout @catalog-mode-sensitive', async ({
    page,
  }) => {
    await page.goto('/checkout');

    await expect(page.getByTestId('empty-checkout')).toBeVisible();
    await expect(page.getByTestId('checkout-form')).toHaveCount(0);
  });

  test('shows validation errors before opening confirmation @critical @checkout @catalog-mode-sensitive', async ({
    page,
  }) => {
    await openCheckoutWithSeededProduct(page);

    await page.getByTestId('checkout-submit').click();

    await expect(page.getByTestId('checkout-confirm-dialog')).toHaveCount(0);
    await expect(page.getByTestId('checkout-error-name')).toBeVisible();
    await expect(page.getByTestId('checkout-error-phone')).toBeVisible();
    await expect(page.getByTestId('checkout-error-email')).toBeVisible();
    await expect(page.getByTestId('checkout-error-city')).toBeVisible();
    await expect(page.getByTestId('checkout-error-shippingMethod')).toBeVisible();
    await expect(page.getByTestId('checkout-error-paymentMethods')).toBeVisible();
  });

  test('validates phone and email formats before opening confirmation @critical @checkout @catalog-mode-sensitive', async ({
    page,
  }) => {
    await openCheckoutWithSeededProduct(page);
    await fillCheckoutCustomerDetails(page, {
      phone: 'not-a-phone',
      email: 'checkout@example',
    });
    await page.getByTestId('shipping-boxnow').click();
    await page.locator('#address').fill('E2E BoxNow delivery address');

    await page.getByTestId('checkout-submit').click();

    await expect(page.getByTestId('checkout-confirm-dialog')).toHaveCount(0);
    await expect(page.getByTestId('checkout-error-phone')).toBeVisible();
    await expect(page.getByTestId('checkout-error-email')).toBeVisible();
  });

  test('opens confirmation with a mocked Speedy office lookup @critical @checkout @catalog-mode-sensitive', async ({
    page,
  }) => {
    await mockSpeedyOfficeLookup(page);
    await openCheckoutWithSeededProduct(page);
    await fillCheckoutCustomerDetails(page);
    await page.getByTestId('shipping-speedy').click();
    await expect(page.getByTestId('speedy-office')).toContainText('E2E Speedy Office 1');
    await page.getByTestId('speedy-office').selectOption('E2E Speedy Office 1');
    await page.getByTestId('payment-cod').check();

    await page.getByTestId('checkout-submit').click();

    await expect(page.getByTestId('checkout-confirm-dialog')).toBeVisible();
    await expect(page.getByTestId('checkout-confirm-dialog')).toContainText('E2E Speedy Office 1');
  });

  test('validates Box Now address and forces card payment @critical @checkout @catalog-mode-sensitive', async ({
    page,
  }) => {
    await openCheckoutWithSeededProduct(page);
    await fillCheckoutCustomerDetails(page);
    await page.getByTestId('shipping-boxnow').click();

    await expect(page.getByTestId('payment-card')).toBeChecked();
    await expect(page.getByTestId('payment-cod')).toHaveCount(0);

    await page.locator('#address').fill('short');
    await page.getByTestId('checkout-submit').click();

    await expect(page.getByTestId('checkout-confirm-dialog')).toHaveCount(0);
    await expect(page.getByTestId('checkout-error-address')).toBeVisible();
  });

  test('creates a COD order with a mocked Econt office lookup @critical @checkout @catalog-mode-sensitive', async ({
    page,
  }) => {
    await mockEcontOfficeLookup(page);
    await openCheckoutWithSeededProduct(page);

    await fillCheckoutCustomerDetails(page);
    await page.getByTestId('shipping-econt').click();
    await expect(page.getByTestId('econt-office')).toContainText('E2E Econt Office 1');
    await page.getByTestId('econt-office').selectOption('E2E Econt Office 1');
    await page.getByTestId('payment-cod').check();

    await page.getByTestId('checkout-submit').click();
    await expect(page.getByTestId('checkout-confirm-dialog')).toBeVisible();
    await expect(page.getByTestId('checkout-confirm-dialog')).toContainText('E2E Checkout Buyer');
    await expect(page.getByTestId('checkout-confirm-dialog')).toContainText('E2E Econt Office 1');

    const orderResponsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/orders') && response.request().method() === 'POST'
    );

    await page.getByTestId('confirm-order').click();

    const orderResponse = await orderResponsePromise;
    expect(orderResponse.status()).toBe(201);

    const orderResult = await orderResponse.json();
    expect(orderResult.orderId).toEqual(expect.any(String));

    await expect(page.getByTestId('checkout-success')).toBeVisible();
    await expect(page).toHaveURL(/\/products$/, { timeout: 8_000 });
  });
});
