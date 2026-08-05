import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { sendEmail } from '../../helpers/sendEmail.js';
import { createExpressApp } from '../../server.js';

describe('contacts integration', () => {
  afterEach(() => {
    delete process.env.CARTOONS_SERVICE_ENABLED;
    delete process.env.NEXT_PUBLIC_CARTOONS_SERVICE_ENABLED;
  });

  it('validates and sends contact form data', async () => {
    const app = createExpressApp();

    const res = await request(app)
      .post('/contacts')
      .set('x-forwarded-for', '203.0.113.10')
      .send({
        name: 'Petya',
        email: 'petya@example.com',
        phone: '+359888123456',
        message: 'I have a question.',
        productUrl: 'https://happycolors.example/products/1',
      })
      .expect(200);

    expect(res.body.message).toBeTruthy();
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ subject: expect.any(String) }));
  });

  it('preserves normal product inquiry email subject and product context', async () => {
    const app = createExpressApp();

    await request(app)
      .post('/contacts')
      .set('x-forwarded-for', '203.0.113.22')
      .send({
        name: 'Petya',
        email: 'petya@example.com',
        message: 'I have a product question.',
        productId: 'product-1',
        productTitle: 'Lavender Candle',
        productUrl: 'https://happycolors.example/products/product-1',
      })
      .expect(200);

    const sentEmail = sendEmail.mock.calls[0][0];

    expect(sentEmail.subject).toBe('Запитване за: Lavender Candle');
    expect(sentEmail.text).toContain('Продукт: Lavender Candle');
    expect(sentEmail.text).toContain('Product ID: product-1');
    expect(sentEmail.text).toContain('Линк: https://happycolors.example/products/product-1');
  });

  it('rejects invalid contact payloads before sending email', async () => {
    const app = createExpressApp();

    await request(app)
      .post('/contacts')
      .set('x-forwarded-for', '203.0.113.11')
      .send({
        name: 'Pe',
        email: 'not-email',
        message: '<script>alert(1)</script>',
      })
      .expect(400);

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('accepts 1000-character contact messages and rejects longer ones', async () => {
    const app = createExpressApp();
    const basePayload = {
      name: 'Petya',
      email: 'petya@example.com',
    };

    await request(app)
      .post('/contacts')
      .set('x-forwarded-for', '203.0.113.13')
      .send({
        ...basePayload,
        message: 'x'.repeat(1000),
      })
      .expect(200);

    await request(app)
      .post('/contacts')
      .set('x-forwarded-for', '203.0.113.14')
      .send({
        ...basePayload,
        message: 'x'.repeat(1001),
      })
      .expect(400);
  });

  it('does not honor cartoon service contact payloads while the release gate is off', async () => {
    const app = createExpressApp();

    await request(app)
      .post('/contacts')
      .set('x-forwarded-for', '203.0.113.15')
      .send({
        name: 'Petya',
        email: 'petya@example.com',
        service: 'cartoons',
        message: 'x'.repeat(1001),
      })
      .expect(400);
  });

  it('treats off-gate cartoon service payloads as normal contact emails', async () => {
    const app = createExpressApp();

    await request(app)
      .post('/contacts')
      .set('x-forwarded-for', '203.0.113.19')
      .send({
        name: 'Petya',
        email: 'petya@example.com',
        service: 'cartoons',
        message: 'Cartoon idea.',
      })
      .expect(200);

    const sentEmail = sendEmail.mock.calls[0][0];

    expect(sentEmail.subject).not.toContain('шарж');
    expect(sentEmail.text).not.toContain('Шаржове');
  });

  it('does not honor cartoon service contact payloads with the server-only flag', async () => {
    process.env.CARTOONS_SERVICE_ENABLED = 'true';
    const app = createExpressApp();

    await request(app)
      .post('/contacts')
      .set('x-forwarded-for', '203.0.113.22')
      .send({
        name: 'Petya',
        email: 'petya@example.com',
        service: 'cartoons',
        message: 'x'.repeat(1001),
      })
      .expect(400);
  });

  it('uses the 1500-character limit only for released cartoon service contact payloads', async () => {
    process.env.NEXT_PUBLIC_CARTOONS_SERVICE_ENABLED = 'true';
    const app = createExpressApp();
    const basePayload = {
      name: 'Petya',
      email: 'petya@example.com',
      service: 'cartoons',
    };

    await request(app)
      .post('/contacts')
      .set('x-forwarded-for', '203.0.113.16')
      .send({
        ...basePayload,
        message: 'x'.repeat(1500),
      })
      .expect(200);

    await request(app)
      .post('/contacts')
      .set('x-forwarded-for', '203.0.113.17')
      .send({
        ...basePayload,
        message: 'x'.repeat(1501),
      })
      .expect(400);
  });

  it('requires an exact cartoons service value even when the contact release gate is enabled', async () => {
    process.env.NEXT_PUBLIC_CARTOONS_SERVICE_ENABLED = 'true';
    const app = createExpressApp();

    await request(app)
      .post('/contacts')
      .set('x-forwarded-for', '203.0.113.20')
      .send({
        name: 'Petya',
        email: 'petya@example.com',
        service: ' cartoons ',
        message: 'x'.repeat(1001),
      })
      .expect(400);
  });

  it('rejects forbidden markup in the service field', async () => {
    process.env.NEXT_PUBLIC_CARTOONS_SERVICE_ENABLED = 'true';
    const app = createExpressApp();

    await request(app)
      .post('/contacts')
      .set('x-forwarded-for', '203.0.113.21')
      .send({
        name: 'Petya',
        email: 'petya@example.com',
        service: '<b>cartoons</b>',
        message: 'Cartoon idea.',
      })
      .expect(400);
  });

  it('omits client-supplied product title and product URLs from released cartoon contact emails', async () => {
    process.env.NEXT_PUBLIC_CARTOONS_SERVICE_ENABLED = 'true';
    const app = createExpressApp();

    await request(app)
      .post('/contacts')
      .set('x-forwarded-for', '203.0.113.18')
      .send({
        name: 'Petya',
        email: 'petya@example.com',
        service: 'cartoons',
        productId: 'product-1',
        productTitle: 'Client supplied title',
        productUrl: 'not-a-valid-url',
        message: 'Cartoon idea.',
      })
      .expect(200);

    const sentEmail = sendEmail.mock.calls[0][0];

    expect(sentEmail.subject).toContain('шарж');
    expect(sentEmail.text).toContain('Product ID: product-1');
    expect(sentEmail.text).not.toContain('Client supplied title');
    expect(sentEmail.text).not.toContain('not-a-valid-url');
    expect(sentEmail.text).not.toContain('/products/product-1');
  });

  it('rate limits repeated contact submissions from the same IP', async () => {
    const app = createExpressApp();
    const payload = {
      name: 'Petya',
      email: 'petya@example.com',
      message: 'I have a question.',
    };

    for (let index = 0; index < 5; index += 1) {
      await request(app).post('/contacts').set('x-forwarded-for', '203.0.113.12').send(payload).expect(200);
    }

    const res = await request(app)
      .post('/contacts')
      .set('x-forwarded-for', '203.0.113.12')
      .send(payload)
      .expect(429);

    expect(res.headers['retry-after']).toBeTruthy();
  });
});
