import { afterEach, describe, expect, it, vi } from 'vitest';
import PaymentCancelPage from '@/app/checkout/payment-cancel/page';
import { act, render } from '../test-utils.jsx';

const catalogModeState = vi.hoisted(() => ({
  value: false,
}));

vi.mock('@/utils/catalogMode', () => ({
  get isCatalogMode() {
    return catalogModeState.value;
  },
}));

describe('PaymentCancelPage', () => {
  afterEach(() => {
    vi.useRealTimers();
    catalogModeState.value = false;
  });

  it('shows a cancellation message and redirects back to checkout after the timer', async () => {
    vi.useFakeTimers();
    const mockRouterPush = vi.fn();
    const { container } = render(<PaymentCancelPage />, { mockRouterPush });

    expect(container.textContent).toMatch(/Плащането/);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    expect(mockRouterPush).toHaveBeenCalledWith('/checkout');
  });

  it('clears its redirect timer when unmounted', async () => {
    vi.useFakeTimers();
    const mockRouterPush = vi.fn();
    const { unmount } = render(<PaymentCancelPage />, { mockRouterPush });

    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it('redirects catalog-mode visitors to products without scheduling checkout redirect', async () => {
    vi.useFakeTimers();
    catalogModeState.value = true;
    const mockRouterPush = vi.fn();
    const { container } = render(<PaymentCancelPage />, { mockRouterPush });

    expect(container.textContent).toBe('');
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockRouterPush).toHaveBeenCalledWith('/products');

    mockRouterPush.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(mockRouterPush).not.toHaveBeenCalled();
  });
});
