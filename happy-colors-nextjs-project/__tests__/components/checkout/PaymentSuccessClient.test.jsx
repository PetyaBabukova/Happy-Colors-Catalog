import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PaymentSuccessClient from '@/app/checkout/payment-success/PaymentSuccessClient';
import { act, render } from '../test-utils.jsx';
import { setMockNavigation } from '../setup.js';
import { jsonResponse } from '../../api/_helpers.js';

async function flushEffects(times = 6) {
  for (let i = 0; i < times; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

describe('PaymentSuccessClient', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.stubGlobal('fetch', vi.fn());
    vi.spyOn(console, 'error').mockImplementation(() => {});
    window.localStorage.clear();
    window.sessionStorage.clear();
    setMockNavigation({ searchParams: new URLSearchParams('session_id=cs_test_123') });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('confirms the Stripe session, clears checkout state, and redirects to products', async () => {
    vi.useFakeTimers();
    const clearCart = vi.fn();
    const mockRouterPush = vi.fn();
    window.localStorage.setItem('hc_order_draft', JSON.stringify({ id: 'draft' }));
    window.localStorage.setItem('hc_shipping_choice', JSON.stringify({ method: 'econt' }));
    fetch.mockResolvedValueOnce(jsonResponse({ body: { orderId: 'order-1' } }));

    render(<PaymentSuccessClient />, {
      cartOverrides: { clearCart },
      mockRouterPush,
    });

    await flushEffects();

    expect(fetch).toHaveBeenCalledWith('/api/payments/confirm?session_id=cs_test_123');
    expect(clearCart).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem('hc_order_draft')).toBeNull();
    expect(window.localStorage.getItem('hc_shipping_choice')).toBeNull();
    expect(JSON.parse(window.sessionStorage.getItem('hc_processed_stripe_sessions'))).toEqual(['cs_test_123']);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(mockRouterPush).toHaveBeenCalledWith('/products');
  });

  it('does not call confirm twice for an already processed session', async () => {
    vi.useFakeTimers();
    const mockRouterPush = vi.fn();
    window.sessionStorage.setItem('hc_processed_stripe_sessions', JSON.stringify(['cs_test_123']));

    const { container } = render(<PaymentSuccessClient />, { mockRouterPush });

    await flushEffects();

    expect(fetch).not.toHaveBeenCalled();
    expect(container.textContent).toContain(
      '\u041f\u043b\u0430\u0449\u0430\u043d\u0435\u0442\u043e \u0432\u0435\u0447\u0435 \u0435 \u043f\u043e\u0442\u0432\u044a\u0440\u0434\u0435\u043d\u043e'
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(mockRouterPush).toHaveBeenCalledWith('/products');
  });

  it('shows an error and redirects when the session id is missing', async () => {
    vi.useFakeTimers();
    const mockRouterPush = vi.fn();
    setMockNavigation({ searchParams: new URLSearchParams() });

    const { container } = render(<PaymentSuccessClient />, { mockRouterPush });

    await flushEffects();

    expect(container.textContent).toMatch(/session_id/);
    expect(fetch).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(mockRouterPush).toHaveBeenCalledWith('/products');
  });

  it('shows backend confirm errors and does not clear the cart', async () => {
    vi.useFakeTimers();
    const clearCart = vi.fn();
    const mockRouterPush = vi.fn();
    fetch.mockResolvedValueOnce(jsonResponse({ ok: false, body: { message: 'Payment mismatch' } }));

    const { container } = render(<PaymentSuccessClient />, {
      cartOverrides: { clearCart },
      mockRouterPush,
    });

    await flushEffects();

    expect(container.textContent).toContain('Payment mismatch');
    expect(clearCart).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem('hc_processed_stripe_sessions')).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(mockRouterPush).toHaveBeenCalledWith('/products');
  });
});
