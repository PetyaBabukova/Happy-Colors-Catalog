import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Order from '../../models/Order.js';
import { createExpressApp } from '../../server.js';
import { buildOrder, createProduct } from './factories.js';

describe('orders integration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a COD order from database product data', async () => {
    const app = createExpressApp();
    const product = await createProduct({ title: 'Order Candle', price: 15 });

    const res = await request(app)
      .post('/orders')
      .set('x-forwarded-for', '203.0.113.20')
      .send(buildOrder({ product, cartItems: [{ productId: String(product._id), quantity: 2 }] }))
      .expect(201);
    const order = await Order.findById(res.body.orderId).lean();

    expect(order.totalPrice).toBe(30);
    expect(order.items).toEqual([
      expect.objectContaining({
        title: 'Order Candle',
        quantity: 2,
        unitPrice: 15,
      }),
    ]);
  });

  it('rejects card payments and missing products in the direct order route', async () => {
    const app = createExpressApp();
    const product = await createProduct();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await request(app)
      .post('/orders')
      .set('x-forwarded-for', '203.0.113.21')
      .send(buildOrder({ product, paymentMethod: 'card' }))
      .expect(400);

    await request(app)
      .post('/orders')
      .set('x-forwarded-for', '203.0.113.22')
      .send(buildOrder({ product: '507f1f77bcf86cd799439011' }))
      .expect(404);
  });
});
