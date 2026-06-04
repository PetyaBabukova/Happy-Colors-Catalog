import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NewsletterConfirmClient from '@/app/newsletter/confirm/NewsletterConfirmClient';
import { confirmNewsletterSubscription } from '@/managers/newsletterManager';
import { act, fireEvent, render, screen, waitFor } from '../test-utils.jsx';

vi.mock('@/managers/newsletterManager', () => ({
  confirmNewsletterSubscription: vi.fn(),
}));

function setConfirmUrl(hash = '') {
  window.history.pushState(null, '', `/newsletter/confirm${hash}`);
}

describe('NewsletterConfirmClient', () => {
  beforeEach(() => {
    vi.useRealTimers();
    confirmNewsletterSubscription.mockResolvedValue({ message: 'confirmed' });
    setConfirmUrl('');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows an invalid-link state when the token is missing', async () => {
    render(<NewsletterConfirmClient />);

    await waitFor(() => {
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
    expect(confirmNewsletterSubscription).not.toHaveBeenCalled();
  });

  it('does not confirm on mount and strips the hash after reading the token', async () => {
    setConfirmUrl('#token=token-1');

    render(<NewsletterConfirmClient />);

    await waitFor(() => expect(screen.getByRole('button')).toBeInTheDocument());
    expect(confirmNewsletterSubscription).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('');
  });

  it('posts the token after click and redirects to products after the success delay', async () => {
    setConfirmUrl('#token=token-1');
    const mockRouterReplace = vi.fn();

    render(<NewsletterConfirmClient />, {
      routerOverrides: { replace: mockRouterReplace },
    });

    await waitFor(() => expect(screen.getByRole('button')).toBeInTheDocument());
    vi.useFakeTimers();

    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });

    expect(confirmNewsletterSubscription).toHaveBeenCalledWith('token-1');
    expect(screen.getByRole('status')).toHaveTextContent('confirmed');
    expect(mockRouterReplace).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(mockRouterReplace).toHaveBeenCalledWith('/products');
  });

  it('shows invalid or expired token errors from the backend', async () => {
    setConfirmUrl('#token=expired-token');
    confirmNewsletterSubscription.mockRejectedValueOnce(new Error('expired'));

    render(<NewsletterConfirmClient />);

    await waitFor(() => expect(screen.getByRole('button')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => expect(confirmNewsletterSubscription).toHaveBeenCalledWith('expired-token'));
    expect(screen.getByRole('status')).toHaveTextContent('expired');
  });
});
