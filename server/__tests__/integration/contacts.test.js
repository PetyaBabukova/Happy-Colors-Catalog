import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { sendEmail } from '../../helpers/sendEmail.js';
import { createExpressApp } from '../../server.js';

describe('contacts integration', () => {
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
});
