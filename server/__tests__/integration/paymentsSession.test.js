import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CheckoutDraft from '../../models/CheckoutDraft.js';
import Order from '../../models/Order.js';
import Payment from '../../models/Payment.js';
import { createProduct } from './factories.js';

const { Stripe, checkoutCreate, checkoutRetrieve } = vi.hoisted(() => ({
  Stripe: vi.fn(),
  checkoutCreate: vi.fn(),
  checkoutRetrieve: vi.fn(),
}));

vi.mock('stripe', () => ({
  default: Stripe,
}));

const { createCardPaymentSession, confirmCardPaymentSession } = await import('../../services/paymentsService.js');

function buildCardOrder(product, overrides = {}) {
  return {
    name: '<b>Petya Babukova</b>',
    email: 'petya@example.com',
    phone: '+359888123456',
    city: 'Sofia',
    address: 'Locker address 1',
    note: '<script>alert(1)</script>Gift wrap',
    paymentMethod: 'card',
    shippingMethod: 'boxnow',
    boxNow: true,
    cartItems: [{ productId: String(product._id), quantity: 2 }],
    ...overrides,
  };
}

async function createOpenDraftAndPayment() {
  const product = await createProduct({ title: 'Stripe Candle', price: 11.25 });
  const draft = await CheckoutDraft.create({
    customer: {
      name: 'Petya Babukova',
      email: 'petya@example.com',
      phone: '+359888123456',
      city: 'Sofia',
      address: 'Locker address 1',
      note: '',
    },
    shipping: {
      shippingMethod: 'boxnow',
      econtOffice: '',
      speedyOffice: '',
      boxNow: true,
    },
    items: [{ productId: product._id, title: product.title, quantity: 1, unitPrice: product.price }],
    totalPrice: product.price,
    currency: 'eur',
    status: 'open',
  });
  const payment = await Payment.create({
    provider: 'stripe',
    amount: Math.round(Number(draft.totalPrice) * 100),
    currency: 'eur',
    status: 'pending',
    draftId: draft._id,
  });

  return { draft, payment };
}

describe('card payment session integration', () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_integration';
    process.env.CLIENT_URL = 'http://client.test';

    checkoutCreate.mockResolvedValue({
      id: 'cs_created_123',
      url: 'https://stripe.test/checkout',
    });
    checkoutRetrieve.mockReset();
    Stripe.mockImplementation(() => ({
      checkout: {
        sessions: {
          create: checkoutCreate,
          retrieve: checkoutRetrieve,
        },
      },
    }));
  });

  afterEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.CLIENT_URL;
  });

  it('creates a Stripe session and persists a sanitized draft and pending payment', async () => {
    const product = await createProduct({ title: 'Rainbow Candle', price: 19.99 });

    await expect(createCardPaymentSession(buildCardOrder(product))).resolves.toEqual({
      url: 'https://stripe.test/checkout',
    });

    const draft = await CheckoutDraft.findOne().lean();
    const payment = await Payment.findOne().lean();

    expect(Stripe).toHaveBeenCalledWith('sk_test_integration');
    expect(checkoutCreate).toHaveBeenCalledWith({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: { name: 'Rainbow Candle' },
            unit_amount: 1999,
          },
          quantity: 2,
        },
      ],
      success_url: 'http://client.test/checkout/payment-success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'http://client.test/checkout/payment-cancel',
      customer_email: 'petya@example.com',
      metadata: {
        paymentId: String(payment._id),
        draftId: String(draft._id),
      },
    });
    expect(draft.customer).toMatchObject({
      name: 'Petya Babukova',
      email: 'petya@example.com',
      phone: '+359888123456',
      city: 'Sofia',
      address: 'Locker address 1',
      note: 'alert(1)Gift wrap',
    });
    expect(draft.shipping).toMatchObject({
      shippingMethod: 'boxnow',
      econtOffice: '',
      speedyOffice: '',
      boxNow: true,
    });
    expect(draft.items).toHaveLength(1);
    expect(draft.totalPrice).toBe(39.98);
    expect(payment).toMatchObject({
      provider: 'stripe',
      amount: 3998,
      currency: 'eur',
      status: 'pending',
      stripeSessionId: 'cs_created_123',
    });
    expect(String(payment.draftId)).toBe(String(draft._id));
  });

  it('cleans up persisted draft and payment records when Stripe session creation fails', async () => {
    checkoutCreate.mockRejectedValueOnce(new Error('Stripe unavailable'));
    const product = await createProduct();

    await expect(createCardPaymentSession(buildCardOrder(product))).rejects.toMatchObject({
      statusCode: 500,
      message: 'Stripe unavailable',
    });

    expect(await CheckoutDraft.countDocuments()).toBe(0);
    expect(await Payment.countDocuments()).toBe(0);
  });

  it('rejects invalid card checkout input before calling Stripe', async () => {
    const product = await createProduct();

    await expect(
      createCardPaymentSession(buildCardOrder(product, { shippingMethod: 'econt', econtOffice: '' }))
    ).rejects.toMatchObject({ statusCode: 400 });

    await expect(
      createCardPaymentSession(buildCardOrder(product, { cartItems: [{ productId: String(product._id), quantity: 0 }] }))
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(checkoutCreate).not.toHaveBeenCalled();
    expect(await CheckoutDraft.countDocuments()).toBe(0);
    expect(await Payment.countDocuments()).toBe(0);
  });

  it('rejects invalid Stripe session creation responses and cleans up state', async () => {
    checkoutCreate.mockResolvedValueOnce({ id: '', url: 'https://stripe.test/missing-id' });
    const product = await createProduct();

    await expect(createCardPaymentSession(buildCardOrder(product))).rejects.toMatchObject({
      statusCode: 500,
    });

    expect(await CheckoutDraft.countDocuments()).toBe(0);
    expect(await Payment.countDocuments()).toBe(0);
  });

  it('retrieves and confirms a paid Stripe session into an order', async () => {
    const { draft, payment } = await createOpenDraftAndPayment();
    checkoutRetrieve.mockResolvedValue({
      id: 'cs_confirm_123',
      payment_status: 'paid',
      amount_total: Math.round(Number(draft.totalPrice) * 100),
      currency: 'eur',
      payment_intent: 'pi_confirm_123',
      metadata: {
        paymentId: String(payment._id),
        draftId: String(draft._id),
      },
    });

    const result = await confirmCardPaymentSession(' cs_confirm_123 ');

    const order = await Order.findById(result.orderId).lean();
    const updatedPayment = await Payment.findById(payment._id).lean();

    expect(checkoutRetrieve).toHaveBeenCalledWith('cs_confirm_123', {
      expand: ['payment_intent'],
    });
    expect(order).toMatchObject({
      paymentMethod: 'card',
      status: 'processing',
      totalPrice: draft.totalPrice,
    });
    expect(updatedPayment).toMatchObject({
      status: 'paid',
      stripeSessionId: 'cs_confirm_123',
      stripePaymentIntentId: 'pi_confirm_123',
    });
  });

  it('rejects blank confirm session ids before calling Stripe', async () => {
    await expect(confirmCardPaymentSession('   ')).rejects.toMatchObject({ statusCode: 400 });

    expect(checkoutRetrieve).not.toHaveBeenCalled();
  });
});
