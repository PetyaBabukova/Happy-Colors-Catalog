import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createUnifiedRoutingApp } from '../../unifiedRouting.js';

async function readRequestBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString('utf8');
}

function buildNextHandler() {
  return vi.fn(async (req, res) => {
    const body = await readRequestBody(req);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      body,
      originalUrl: req.originalUrl,
      url: req.url,
    }));
  });
}

function buildExpressApp() {
  const expressApp = express();
  const bodyParserSpy = vi.fn();
  const handlerSpy = vi.fn();

  expressApp.use((req, res, next) => {
    bodyParserSpy(req.originalUrl || req.url);
    express.json()(req, res, next);
  });

  expressApp.use((req, res) => {
    handlerSpy({
      body: req.body,
      originalUrl: req.originalUrl,
      url: req.url,
    });
    res.status(200).json({
      body: req.body,
      originalUrl: req.originalUrl,
      url: req.url,
    });
  });

  return { expressApp, bodyParserSpy, handlerSpy };
}

function buildWebhookExpressApp() {
  const expressApp = express();
  const webhookSpy = vi.fn();

  expressApp.use('/payments/webhook', express.raw({ type: 'application/json' }));
  expressApp.use(express.json());
  expressApp.post('/payments/webhook', (req, res) => {
    webhookSpy({
      bodyIsBuffer: Buffer.isBuffer(req.body),
      bodyText: Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '',
      originalUrl: req.originalUrl,
      url: req.url,
    });
    res.status(200).json({ bodyIsBuffer: Buffer.isBuffer(req.body) });
  });

  return { expressApp, webhookSpy };
}

describe('createUnifiedRoutingApp', () => {
  it('sends product revalidation to Next before Express can read the body', async () => {
    const { expressApp, bodyParserSpy, handlerSpy } = buildExpressApp();
    const nextHandler = buildNextHandler();
    const app = createUnifiedRoutingApp({ expressApp, nextHandler });
    const payload = { productId: 'product-1' };

    const response = await request(app)
      .post('/api/revalidate/products?source=admin')
      .send(payload)
      .set('Content-Type', 'application/json')
      .expect(200);

    expect(nextHandler).toHaveBeenCalledTimes(1);
    expect(bodyParserSpy).not.toHaveBeenCalled();
    expect(handlerSpy).not.toHaveBeenCalled();
    expect(response.body.originalUrl).toBe('/api/revalidate/products?source=admin');
    expect(response.body.url).toBe('/api/revalidate/products?source=admin');
    expect(JSON.parse(response.body.body)).toEqual(payload);
  });

  it.each([
    '/api/revalidate/blog',
    '/api/revalidate/home-banners',
    '/api/revalidate/cartoon-hero-banners',
    '/api/uploads/sign',
  ])('sends Next-owned JSON POST %s to Next before Express body parsing', async (path) => {
    const { expressApp, bodyParserSpy } = buildExpressApp();
    const nextHandler = buildNextHandler();
    const app = createUnifiedRoutingApp({ expressApp, nextHandler });

    const response = await request(app)
      .post(path)
      .send({ ok: true })
      .set('Content-Type', 'application/json')
      .expect(200);

    expect(nextHandler).toHaveBeenCalledTimes(1);
    expect(bodyParserSpy).not.toHaveBeenCalled();
    expect(JSON.parse(response.body.body)).toEqual({ ok: true });
  });

  it('keeps backend API requests on the Express /api mount', async () => {
    const { expressApp, handlerSpy } = buildExpressApp();
    const nextHandler = buildNextHandler();
    const app = createUnifiedRoutingApp({ expressApp, nextHandler });

    const response = await request(app)
      .get('/api/products/123')
      .expect(200);

    expect(nextHandler).not.toHaveBeenCalled();
    expect(handlerSpy).toHaveBeenCalledWith(expect.objectContaining({
      originalUrl: '/api/products/123',
      url: '/products/123',
    }));
    expect(response.body.url).toBe('/products/123');
  });

  it('keeps translation management requests on the Express /api mount', async () => {
    const { expressApp, handlerSpy } = buildExpressApp();
    const nextHandler = buildNextHandler();
    const app = createUnifiedRoutingApp({ expressApp, nextHandler });

    const response = await request(app)
      .get('/api/translations/queue?locale=en')
      .expect(200);

    expect(nextHandler).not.toHaveBeenCalled();
    expect(handlerSpy).toHaveBeenCalledWith({
      originalUrl: '/api/translations/queue?locale=en',
      url: '/translations/queue?locale=en',
    });
    expect(response.body.url).toBe('/translations/queue?locale=en');
  });

  it('keeps cartoon order creation and admin subroutes on Express without taking over Next-owned upload routes', async () => {
    const { expressApp, handlerSpy, bodyParserSpy } = buildExpressApp();
    const nextHandler = buildNextHandler();
    const app = createUnifiedRoutingApp({ expressApp, nextHandler });

    await request(app)
      .post('/api/cartoon-orders')
      .send({ ok: true })
      .set('Content-Type', 'application/json')
      .expect(200);

    expect(nextHandler).not.toHaveBeenCalled();
    expect(bodyParserSpy).toHaveBeenCalledWith('/api/cartoon-orders');
    expect(handlerSpy).toHaveBeenCalledWith(expect.objectContaining({
      body: { ok: true },
      originalUrl: '/api/cartoon-orders',
      url: '/cartoon-orders',
    }));

    await request(app)
      .patch('/api/cartoon-orders/665f1f77bcf86cd799439011/statuses')
      .send({ statuses: { paid: true } })
      .set('Content-Type', 'application/json')
      .expect(200);

    expect(handlerSpy).toHaveBeenCalledWith(expect.objectContaining({
      body: { statuses: { paid: true } },
      originalUrl: '/api/cartoon-orders/665f1f77bcf86cd799439011/statuses',
      url: '/cartoon-orders/665f1f77bcf86cd799439011/statuses',
    }));

    const uploadResponse = await request(app)
      .post('/api/cartoon-orders/uploads')
      .send({ ok: true })
      .set('Content-Type', 'application/json')
      .expect(200);

    expect(nextHandler).toHaveBeenCalledTimes(1);
    expect(JSON.parse(uploadResponse.body.body)).toEqual({ ok: true });
  });

  it('keeps the bare API root on Express', async () => {
    const { expressApp, handlerSpy } = buildExpressApp();
    const nextHandler = buildNextHandler();
    const app = createUnifiedRoutingApp({ expressApp, nextHandler });

    const response = await request(app)
      .get('/api')
      .expect(200);

    expect(nextHandler).not.toHaveBeenCalled();
    expect(handlerSpy).toHaveBeenCalledWith(expect.objectContaining({
      originalUrl: '/api',
      url: '/',
    }));
    expect(response.body.url).toBe('/');
  });

  it('keeps Stripe webhook requests on Express', async () => {
    const { expressApp, handlerSpy } = buildExpressApp();
    const nextHandler = buildNextHandler();
    const app = createUnifiedRoutingApp({ expressApp, nextHandler });

    await request(app)
      .post('/api/payments/webhook')
      .send({ event: 'checkout.session.completed' })
      .set('Content-Type', 'application/json')
      .expect(200);

    expect(nextHandler).not.toHaveBeenCalled();
    expect(handlerSpy).toHaveBeenCalledWith(expect.objectContaining({
      originalUrl: '/api/payments/webhook',
      url: '/payments/webhook',
    }));
  });

  it('preserves raw webhook bodies for Express raw parsing', async () => {
    const { expressApp, webhookSpy } = buildWebhookExpressApp();
    const nextHandler = buildNextHandler();
    const app = createUnifiedRoutingApp({ expressApp, nextHandler });
    const rawPayload = JSON.stringify({ event: 'checkout.session.completed' });

    const response = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .send(rawPayload)
      .expect(200);

    expect(nextHandler).not.toHaveBeenCalled();
    expect(response.body.bodyIsBuffer).toBe(true);
    expect(webhookSpy).toHaveBeenCalledWith({
      bodyIsBuffer: true,
      bodyText: rawPayload,
      originalUrl: '/api/payments/webhook',
      url: '/payments/webhook',
    });
  });

  it('sends non-API pages to Next', async () => {
    const { expressApp, handlerSpy } = buildExpressApp();
    const nextHandler = buildNextHandler();
    const app = createUnifiedRoutingApp({ expressApp, nextHandler });

    const response = await request(app)
      .get('/products')
      .expect(200);

    expect(handlerSpy).not.toHaveBeenCalled();
    expect(nextHandler).toHaveBeenCalledTimes(1);
    expect(response.body.url).toBe('/products');
  });
});
