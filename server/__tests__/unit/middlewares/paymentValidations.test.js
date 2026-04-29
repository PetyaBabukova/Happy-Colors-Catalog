import { describe, expect, it } from 'vitest';
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

  it('rejects invalid cart item values', () => {
    const req = buildReq({
      body: buildValidBody({ cartItems: [{ title: 'Paint Set', quantity: 0, price: 12 }] }),
    });
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
});
