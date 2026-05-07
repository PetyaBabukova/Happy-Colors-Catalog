import { beforeEach, describe, expect, it, vi } from 'vitest';

const { Stripe } = vi.hoisted(() => ({
  Stripe: vi.fn(),
}));

vi.mock('stripe', () => ({
  default: Stripe,
}));

async function importStripeClient() {
  return import('../../../utils/stripeClient.js');
}

describe('stripeClient', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.STRIPE_SECRET_KEY;
    Stripe.mockImplementation((secretKey) => ({ secretKey }));
  });

  it('returns null when Stripe is not configured', async () => {
    const { getStripeClient } = await importStripeClient();

    expect(getStripeClient()).toBeNull();
    expect(Stripe).not.toHaveBeenCalled();
  });

  it('creates and caches a configured Stripe client', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    const { getStripeClient } = await importStripeClient();

    const firstClient = getStripeClient();
    const secondClient = getStripeClient();

    expect(firstClient).toBe(secondClient);
    expect(firstClient).toEqual({ secretKey: 'sk_test_123' });
    expect(Stripe).toHaveBeenCalledTimes(1);
    expect(Stripe).toHaveBeenCalledWith('sk_test_123');
  });
});
