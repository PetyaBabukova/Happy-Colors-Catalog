import { describe, expect, it, vi } from 'vitest';
import { validateCreatePaymentSession } from '../../../middlewares/paymentValidations.js';
import { buildNext, buildReq, buildRes } from '../_helpers/httpMocks.js';

function buildValidBody(overrides = {}) {
  return {
    email: 'petya@example.com',
    cartItems: [{ title: 'Paint Set', quantity: 2, price: 12.5 }],
    totalPrice: 25,
    shippingMethod: 'office',
    name: 'Petya',
    city: 'Sofia',
    address: 'Main street',
    boxNow: 1,
    ...overrides,
  };
}

describe('validateCreatePaymentSession', () => {
  it('normalizes boxNow and calls next for a valid payment body', () => {
    const req = buildReq({ body: buildValidBody() });
    const res = buildRes();
    const next = buildNext();

    validateCreatePaymentSession(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.body.boxNow).toBe(true);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects missing or invalid email before calling next', () => {
    const req = buildReq({ body: buildValidBody({ email: 'not-an-email' }) });
    const res = buildRes();
    const next = buildNext();

    validateCreatePaymentSession(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: expect.stringContaining('email') });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects missing email before validating the rest of the payload', () => {
    const req = buildReq({ body: buildValidBody({ email: '' }) });
    const res = buildRes();
    const next = buildNext();

    validateCreatePaymentSession(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: expect.stringContaining('email') });
    expect(next).not.toHaveBeenCalled();
  });

  it.each([
    ['non-array cart', { cartItems: null }],
    ['empty cart', { cartItems: [] }],
    ['non-object cart item', { cartItems: [null] }],
    ['missing title', { cartItems: [{ title: '', quantity: 1, price: 12 }] }],
    ['invalid quantity', { cartItems: [{ title: 'Paint Set', quantity: 0, price: 12 }] }],
    ['invalid price', { cartItems: [{ title: 'Paint Set', quantity: 1, price: -1 }] }],
    ['invalid total price', { totalPrice: 0 }],
  ])('rejects %s', (_label, overrides) => {
    const req = buildReq({ body: buildValidBody(overrides) });
    const res = buildRes();
    const next = buildNext();

    validateCreatePaymentSession(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects HTML in cart items or text fields', () => {
    const req = buildReq({
      body: buildValidBody({ note: '<script>alert(1)</script>' }),
    });
    const res = buildRes();
    const next = buildNext();

    validateCreatePaymentSession(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects HTML in cart item titles', () => {
    const req = buildReq({
      body: buildValidBody({ cartItems: [{ title: '<b>Paint</b>', quantity: 1, price: 12 }] }),
    });
    const res = buildRes();
    const next = buildNext();

    validateCreatePaymentSession(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('normalizes falsy boxNow values to false', () => {
    const req = buildReq({ body: buildValidBody({ boxNow: 0 }) });
    const res = buildRes();
    const next = buildNext();

    validateCreatePaymentSession(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.body.boxNow).toBe(false);
  });

  it('returns a 500 validation error when the request body cannot be read', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const req = {};
    Object.defineProperty(req, 'body', {
      get() {
        throw new Error('body parser failed');
      },
    });
    const res = buildRes();
    const next = buildNext();

    validateCreatePaymentSession(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: expect.any(String) });
    expect(next).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      'validateCreatePaymentSession error:',
      expect.any(Error)
    );
  });
});
