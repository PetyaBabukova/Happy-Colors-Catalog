import { describe, expect, it } from 'vitest';
import CheckoutDraft from '../../models/CheckoutDraft.js';
import Order from '../../models/Order.js';
import Payment from '../../models/Payment.js';
import { finalizePaidCheckoutSession } from '../../services/paymentsService.js';
import { createProduct } from './factories.js';

async function createPaymentDraftFixture(overrides = {}) {
  const product = overrides.product || (await createProduct());
  const draft = await CheckoutDraft.create({
    customer: {
      name: 'Petya Babukova',
      email: 'petya@example.com',
      phone: '+359888123456',
      city: 'Sofia',
      address: 'Main street 1',
      note: '',
    },
    shipping: {
      shippingMethod: 'econt',
      econtOffice: 'Econt office 1',
      boxNow: false,
    },
    items: [
      {
        productId: product._id,
        title: product.title,
        quantity: 2,
        unitPrice: product.price,
      },
    ],
    totalPrice: product.price * 2,
    currency: 'eur',
    status: 'open',
    ...overrides.draft,
  });
  const payment = await Payment.create({
    provider: 'stripe',
    amount: Math.round(Number(draft.totalPrice) * 100),
    currency: 'eur',
    status: 'pending',
    draftId: draft._id,
    ...overrides.payment,
  });

  return { draft, payment, product };
}

function buildPaidSession({ payment, draft, ...overrides }) {
  return {
    id: 'cs_test_123',
    payment_status: 'paid',
    amount_total: Math.round(Number(draft.totalPrice) * 100),
    currency: 'eur',
    payment_intent: { id: 'pi_test_123' },
    metadata: {
      paymentId: String(payment._id),
      draftId: String(draft._id),
    },
    ...overrides,
  };
}

describe('payments service integration', () => {
  it('finalizes a paid checkout session into an order', async () => {
    const { draft, payment } = await createPaymentDraftFixture();

    const result = await finalizePaidCheckoutSession(buildPaidSession({ payment, draft }));

    expect(result).toMatchObject({ alreadyProcessed: false });

    const order = await Order.findById(result.orderId).lean();
    const updatedPayment = await Payment.findById(payment._id).lean();
    const updatedDraft = await CheckoutDraft.findById(draft._id).lean();

    expect(order).toMatchObject({
      paymentMethod: 'card',
      status: 'processing',
      totalPrice: draft.totalPrice,
    });
    expect(String(order.paymentId)).toBe(String(payment._id));
    expect(order.items).toHaveLength(1);
    expect(updatedPayment).toMatchObject({
      status: 'paid',
      stripeSessionId: 'cs_test_123',
      stripePaymentIntentId: 'pi_test_123',
    });
    expect(String(updatedPayment.orderId)).toBe(String(order._id));
    expect(updatedDraft.status).toBe('used');
  });

  it('is idempotent when an order already exists for the payment', async () => {
    const { draft, payment, product } = await createPaymentDraftFixture({
      payment: { stripeSessionId: 'cs_test_123' },
    });
    const existingOrder = await Order.create({
      customer: draft.customer,
      shipping: draft.shipping,
      items: [{ productId: product._id, title: product.title, quantity: 2, unitPrice: product.price }],
      totalPrice: draft.totalPrice,
      paymentMethod: 'card',
      status: 'processing',
      paymentId: payment._id,
    });

    const result = await finalizePaidCheckoutSession(
      buildPaidSession({
        payment,
        draft,
        payment_intent: 'pi_existing',
      })
    );

    const updatedPayment = await Payment.findById(payment._id).lean();
    const orderCount = await Order.countDocuments();

    expect(result).toEqual({
      message: expect.any(String),
      orderId: String(existingOrder._id),
      alreadyProcessed: true,
    });
    expect(orderCount).toBe(1);
    expect(updatedPayment.status).toBe('paid');
    expect(updatedPayment.stripePaymentIntentId).toBe('pi_existing');
  });

  it('rejects unpaid sessions before mutating state', async () => {
    const { draft, payment } = await createPaymentDraftFixture();

    await expect(
      finalizePaidCheckoutSession(
        buildPaidSession({
          payment,
          draft,
          payment_status: 'unpaid',
        })
      )
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(await Order.countDocuments()).toBe(0);
    expect((await Payment.findById(payment._id)).status).toBe('pending');
  });

  it('rejects amount mismatches', async () => {
    const { draft, payment } = await createPaymentDraftFixture();

    await expect(
      finalizePaidCheckoutSession(
        buildPaidSession({
          payment,
          draft,
          amount_total: Math.round(draft.totalPrice * 100) + 1,
        })
      )
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(await Order.countDocuments()).toBe(0);
  });

  it('rejects missing Stripe metadata before mutating state', async () => {
    const { draft, payment } = await createPaymentDraftFixture();

    await expect(
      finalizePaidCheckoutSession({
        ...buildPaidSession({ payment, draft }),
        metadata: {},
      })
    ).rejects.toMatchObject({ statusCode: 500 });

    expect(await Order.countDocuments()).toBe(0);
    expect((await Payment.findById(payment._id)).status).toBe('pending');
  });

  it('rejects a Stripe session id mismatch for an existing payment', async () => {
    const { draft, payment } = await createPaymentDraftFixture({
      payment: { stripeSessionId: 'cs_original' },
    });

    await expect(
      finalizePaidCheckoutSession(
        buildPaidSession({
          payment,
          draft,
          id: 'cs_different',
        })
      )
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(await Order.countDocuments()).toBe(0);
    expect((await Payment.findById(payment._id)).status).toBe('pending');
  });

  it('rejects sessions for missing payment or draft records', async () => {
    const missingPaymentFixture = await createPaymentDraftFixture();
    await Payment.findByIdAndDelete(missingPaymentFixture.payment._id);

    await expect(
      finalizePaidCheckoutSession(
        buildPaidSession({
          payment: missingPaymentFixture.payment,
          draft: missingPaymentFixture.draft,
        })
      )
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(await Order.countDocuments()).toBe(0);

    const missingDraftFixture = await createPaymentDraftFixture();
    await CheckoutDraft.findByIdAndDelete(missingDraftFixture.draft._id);

    await expect(
      finalizePaidCheckoutSession(
        buildPaidSession({
          payment: missingDraftFixture.payment,
          draft: missingDraftFixture.draft,
        })
      )
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(await Order.countDocuments()).toBe(0);
  });

  it('rejects currency mismatches', async () => {
    const { draft, payment } = await createPaymentDraftFixture();

    await expect(
      finalizePaidCheckoutSession(
        buildPaidSession({
          payment,
          draft,
          currency: 'usd',
        })
      )
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(await Order.countDocuments()).toBe(0);
  });
});
