import { expect, test } from '@playwright/test';

test.describe('owner session', () => {
  test.use({ storageState: 'e2e/.auth/owner.json' });

  test('reuses seeded owner auth state @critical @auth', async ({ request }) => {
    const response = await request.get('/api/users/me');

    expect(response.status()).toBe(200);
    await expect(response).toBeOK();

    const user = await response.json();

    expect(user).toMatchObject({
      username: 'e2e-owner',
      email: 'owner.e2e@example.com',
    });
  });
});
