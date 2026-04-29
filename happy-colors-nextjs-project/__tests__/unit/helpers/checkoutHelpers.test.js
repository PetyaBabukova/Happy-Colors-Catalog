import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isValidEmail,
  isValidPhone,
  persistDraft,
  validateCheckoutForm,
} from '../../../src/helpers/checkoutHelpers.js';

describe('checkoutHelpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('validates email and phone formats', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidPhone('+359 888 123 456')).toBe(true);
    expect(isValidPhone('123')).toBe(false);
  });

  it('collects checkout validation errors', () => {
    const errors = validateCheckoutForm(
      {
        name: 'Al',
        phone: '123',
        email: 'bad',
        city: '',
        address: 'short',
        paymentMethods: [],
      },
      { shippingMethod: 'boxnow' },
      'cod'
    );

    expect(errors).toMatchObject({
      name: expect.any(String),
      phone: expect.any(String),
      email: expect.any(String),
      city: expect.any(String),
      address: expect.any(String),
      paymentMethods: expect.any(String),
    });
  });

  it('persists a trimmed draft and shipping choice when localStorage is available', () => {
    const setItem = vi.fn();
    vi.stubGlobal('window', {
      localStorage: { setItem },
    });

    const draft = persistDraft(
      {
        name: '  Petya  ',
        email: '  petya@example.com  ',
        phone: '  0888123456  ',
        city: '  Sofia  ',
        address: '  Delivery address  ',
        note: '  note  ',
      },
      'card',
      {
        shippingMethod: 'boxnow',
        econtOffice: '',
        speedyOffice: '',
        boxNow: true,
      }
    );

    expect(draft).toMatchObject({
      name: 'Petya',
      email: 'petya@example.com',
      phone: '0888123456',
      city: 'Sofia',
      address: 'Delivery address',
      note: 'note',
      paymentMethod: 'card',
    });
    expect(setItem).toHaveBeenCalledWith('hc_order_draft', JSON.stringify(draft));
    expect(setItem).toHaveBeenCalledWith(
      'hc_shipping_choice',
      JSON.stringify({
        shippingMethod: 'boxnow',
        econtOffice: '',
        speedyOffice: '',
        boxNow: true,
      })
    );
  });
});
