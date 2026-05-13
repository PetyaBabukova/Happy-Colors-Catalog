import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const constructEvent = vi.fn();
const getStripeClient = vi.fn();
const finalizePaidCheckoutSession = vi.fn();

vi.mock('../../../utils/stripeClient.js', () => ({
  getStripeClient,
}));

vi.mock('../../../services/paymentsService.js', () => ({
  finalizePaidCheckoutSession,
}));

const { handleStripeWebhook } = await import('../../../services/paymentsWebhookService.js');

describe('paymentsWebhookService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.STRIPE_WEBHOOK_SECRET;
    getStripeClient.mockReturnValue({
      webhooks: {
        constructEvent,
      },
    });
    constructEvent.mockReturnValue({ type: 'checkout.session.expired', data: { object: {} } });
    finalizePaidCheckoutSession.mockResolvedValue({ received: true });
  });

  afterEach(() => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it('requires a configured Stripe client', async () => {
    getStripeClient.mockReturnValue(null);
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

    await expect(handleStripeWebhook({ rawBody: Buffer.from('{}'), signature: 'sig' })).rejects.toMatchObject({
      statusCode: 500,
    });
  });

  it('requires a webhook secret', async () => {
    await expect(handleStripeWebhook({ rawBody: Buffer.from('{}'), signature: 'sig' })).rejects.toMatchObject({
      statusCode: 500,
    });
  });

  it('requires a stripe signature header', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

    await expect(handleStripeWebhook({ rawBody: Buffer.from('{}'), signature: '' })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('rejects invalid webhook signatures', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    constructEvent.mockImplementation(() => {
      throw new Error('invalid signature');
    });

    await expect(handleStripeWebhook({ rawBody: Buffer.from('{}'), signature: 'bad' })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('finalizes completed checkout sessions', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    const session = { id: 'cs_test_123' };
    constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: session },
    });

    await expect(handleStripeWebhook({ rawBody: Buffer.from('{}'), signature: 'sig' })).resolves.toEqual({
      received: true,
    });

    expect(constructEvent).toHaveBeenCalledWith(Buffer.from('{}'), 'sig', 'whsec_test');
    expect(finalizePaidCheckoutSession).toHaveBeenCalledWith(session);
  });

  it('acknowledges non-finalizing checkout events', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    constructEvent.mockReturnValue({
      type: 'checkout.session.async_payment_failed',
      data: { object: { id: 'cs_failed' } },
    });

    await expect(handleStripeWebhook({ rawBody: Buffer.from('{}'), signature: 'sig' })).resolves.toEqual({
      received: true,
    });

    expect(finalizePaidCheckoutSession).not.toHaveBeenCalled();
  });
});
