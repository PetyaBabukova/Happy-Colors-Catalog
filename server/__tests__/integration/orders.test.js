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

  it('creates an order with multiple products and speedy shipping', async () => {
    const app = createExpressApp();
    const candle = await createProduct({ title: 'Order Candle', price: 15 });
    const card = await createProduct({ title: 'Color Card', price: 4 });

    const res = await request(app)
      .post('/orders')
      .set('x-forwarded-for', '203.0.113.23')
      .send(
        buildOrder({
          product: candle,
          shippingMethod: 'speedy',
          econtOffice: '',
          speedyOffice: 'Speedy office 1',
          cartItems: [
            { productId: String(candle._id), quantity: 2 },
            { productId: String(card._id), quantity: 3 },
          ],
        })
      )
      .expect(201);
    const order = await Order.findById(res.body.orderId).lean();

    // Direct COD orders currently do not add a shipping surcharge.
    expect(order.totalPrice).toBe(42);
    expect(order.shipping).toMatchObject({
      shippingMethod: 'speedy',
      speedyOffice: 'Speedy office 1',
    });
    expect(order.items).toHaveLength(2);
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

  it('rejects invalid shipping, quantity, and HTML payloads', async () => {
    const app = createExpressApp();
    const product = await createProduct();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await request(app)
      .post('/orders')
      .set('x-forwarded-for', '203.0.113.24')
      .send(buildOrder({ product, econtOffice: '' }))
      .expect(400);

    await request(app)
      .post('/orders')
      .set('x-forwarded-for', '203.0.113.25')
      .send(buildOrder({ product, cartItems: [{ productId: String(product._id), quantity: 1.5 }] }))
      .expect(400);

    await request(app)
      .post('/orders')
      .set('x-forwarded-for', '203.0.113.26')
      .send(buildOrder({ product, name: '<script>alert(1)</script>' }))
      .expect(400);
  });
});
