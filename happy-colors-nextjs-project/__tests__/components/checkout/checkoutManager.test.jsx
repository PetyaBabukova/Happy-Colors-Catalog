import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CartContext } from '@/context/CartContext';
import { useCheckoutManager } from '@/managers/checkoutManager';
import { setMockRouter } from '../setup.js';
import { jsonResponse } from '../../api/_helpers.js';

const cartItems = [{ _id: 'product-1', title: 'Lavender Candle', quantity: 2, price: 18 }];

function wrapperFactory(overrides = {}) {
  const cartValue = {
    cartItems,
    clearCart: vi.fn(),
    getTotalPrice: vi.fn(() => 36),
    ...overrides,
  };

  function Wrapper({ children }) {
    return <CartContext.Provider value={cartValue}>{children}</CartContext.Provider>;
  }

  return { Wrapper, cartValue };
}

function change(name, value) {
  return { target: { name, value } };
}

async function fillValidCustomer(result) {
  await act(async () => {
    result.current.handleChange(change('name', 'Petya Babukova'));
    result.current.handleChange(change('phone', '+359888123456'));
    result.current.handleChange(change('email', 'petya@example.com'));
    result.current.handleChange(change('city', 'Sofia'));
    result.current.setShippingMethod('econt');
    result.current.setEcontOffice('Econt office 1');
    result.current.handlePaymentChange('cod');
  });
}

describe('useCheckoutManager', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('validates required checkout fields before opening confirmation', () => {
    const { Wrapper } = wrapperFactory();
    const { result } = renderHook(() => useCheckoutManager(), { wrapper: Wrapper });

    act(() => {
      result.current.handleSubmit({ preventDefault: vi.fn() });
    });

    expect(result.current.isConfirmOpen).toBe(false);
    expect(result.current.errors).toMatchObject({
      name: expect.any(String),
      phone: expect.any(String),
      email: expect.any(String),
      city: expect.any(String),
      shippingMethod: expect.any(String),
      paymentMethods: expect.any(String),
    });
  });

  it('fetches carrier offices when city and shipping method are selected', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ body: { offices: [{ id: 'office-1', address: 'Office 1' }] } }));
    const { Wrapper } = wrapperFactory();
    const { result } = renderHook(() => useCheckoutManager(), { wrapper: Wrapper });

    await act(async () => {
      result.current.handleChange(change('city', 'Sofia'));
      result.current.setShippingMethod('econt');
    });

    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/delivery/econt/offices?city=Sofia'));
    await waitFor(() => expect(result.current.econtOffices).toEqual([{ id: 'office-1', address: 'Office 1' }]));
    expect(result.current.officesLoading).toBe(false);
  });

  it('fetches Speedy offices through the Express delivery API', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ body: { offices: [{ id: 'speedy-1', address: 'Speedy 1' }] } }));
    const { Wrapper } = wrapperFactory();
    const { result } = renderHook(() => useCheckoutManager(), { wrapper: Wrapper });

    await act(async () => {
      result.current.handleChange(change('city', 'Plovdiv'));
      result.current.setShippingMethod('speedy');
    });

    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/delivery/speedy/offices?city=Plovdiv'));
    await waitFor(() => expect(result.current.speedyOffices).toEqual([{ id: 'speedy-1', address: 'Speedy 1' }]));
    expect(result.current.officesLoading).toBe(false);
  });

  it('keeps office lists empty when the Express delivery API returns an error shape', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({
      ok: false,
      body: { message: 'Backend unavailable', offices: [] },
    }));
    const { Wrapper } = wrapperFactory();
    const { result } = renderHook(() => useCheckoutManager(), { wrapper: Wrapper });

    await act(async () => {
      result.current.handleChange(change('city', 'Sofia'));
      result.current.setShippingMethod('econt');
    });

    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/delivery/econt/offices?city=Sofia'));
    await waitFor(() => expect(console.warn).toHaveBeenCalledWith('Failed to load offices', {
      message: 'Backend unavailable',
      offices: [],
    }));
    expect(result.current.econtOffices).toEqual([]);
    expect(result.current.officesLoading).toBe(false);
  });

  it('opens confirmation and submits cash-on-delivery orders with persisted draft data', async () => {
    vi.useFakeTimers();
    fetch.mockResolvedValue(jsonResponse({ body: { _id: 'order-1' } }));
    const push = vi.fn();
    setMockRouter({ push });
    const { Wrapper, cartValue } = wrapperFactory();
    const { result } = renderHook(() => useCheckoutManager(), { wrapper: Wrapper });

    await fillValidCustomer(result);

    act(() => {
      result.current.handleSubmit({ preventDefault: vi.fn() });
    });

    expect(result.current.isConfirmOpen).toBe(true);

    await act(async () => {
      await result.current.confirmOrder();
    });

    const orderCall = fetch.mock.calls.find(([url]) => url === '/api/orders');
    const payload = JSON.parse(orderCall[1].body);

    expect(fetch).toHaveBeenCalledWith(
      '/api/orders',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
    expect(payload).toMatchObject({
      name: 'Petya Babukova',
      email: 'petya@example.com',
      paymentMethod: 'cod',
      shippingMethod: 'econt',
      econtOffice: 'Econt office 1',
      cartItems,
      totalPrice: 36,
    });
    expect(window.localStorage.getItem('hc_order_draft')).toContain('petya@example.com');
    expect(result.current.submitSuccess).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(cartValue.clearCart).toHaveBeenCalled();
    expect(window.localStorage.getItem('hc_order_draft')).toBeNull();
    expect(push).toHaveBeenCalledWith('/products');
  });

  it('forces card payment for Box Now and ignores COD toggles while Box Now is selected', async () => {
    const { Wrapper } = wrapperFactory();
    const { result } = renderHook(() => useCheckoutManager(), { wrapper: Wrapper });

    await act(async () => {
      result.current.setShippingMethod('boxnow');
    });

    expect(result.current.formData.paymentMethods).toEqual(['card']);

    await act(async () => {
      result.current.handlePaymentChange('cod');
    });

    expect(result.current.formData.paymentMethods).toEqual(['card']);
  });
});
