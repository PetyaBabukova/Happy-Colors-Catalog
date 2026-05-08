import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ContactForm from '@/components/contacts/ContactForm';
import { sendContactForm } from '@/managers/contactsManager';
import { act, fireEvent, render, screen, waitFor } from '../test-utils.jsx';

vi.mock('@/managers/contactsManager', () => ({
  sendContactForm: vi.fn(),
}));

describe('ContactForm', () => {
  beforeEach(() => {
    sendContactForm.mockResolvedValue({ message: 'sent' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('validates required fields before sending', () => {
    const { container } = render(<ContactForm />);

    fireEvent.submit(container.querySelector('form'));

    expect(sendContactForm).not.toHaveBeenCalled();
    expect(container.querySelector('#name').className).not.toBe('');
    expect(container.querySelector('#email').className).not.toBe('');
    expect(container.querySelector('#message').className).not.toBe('');
  });

  it('sends a sanitized product enquiry payload and resets the form', async () => {
    const product = { _id: 'product-1', title: 'Lavender Candle' };
    const { container } = render(<ContactForm product={product} />);

    fireEvent.change(container.querySelector('#name'), { target: { value: ' Petya ' } });
    fireEvent.change(container.querySelector('#email'), { target: { value: 'petya@example.com' } });
    fireEvent.change(container.querySelector('#phone'), { target: { value: ' +359888123456 ' } });
    fireEvent.change(container.querySelector('#message'), { target: { value: ' Please call me. ' } });
    fireEvent.submit(container.querySelector('form'));

    await waitFor(() =>
      expect(sendContactForm).toHaveBeenCalledWith({
        name: 'Petya',
        email: 'petya@example.com',
        phone: '+359888123456',
        message: 'Please call me.',
        productId: 'product-1',
        productTitle: 'Lavender Candle',
        productUrl: `${window.location.origin}/products/product-1`,
      })
    );
    expect(screen.getAllByText(/Lavender Candle/).length).toBeGreaterThan(0);
    expect(container.querySelector('#name')).toHaveValue('');
    expect(container.querySelector('#message')).toHaveValue('');
  });

  it('does not send forbidden markup', async () => {
    const { container } = render(<ContactForm />);

    fireEvent.change(container.querySelector('#name'), { target: { value: 'Petya' } });
    fireEvent.change(container.querySelector('#email'), { target: { value: 'petya@example.com' } });
    fireEvent.change(container.querySelector('#message'), { target: { value: '<b>Hello</b>' } });
    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => {
      expect(container.textContent).toMatch(/забранени/i);
      expect(sendContactForm).not.toHaveBeenCalled();
    });
  });

  it('clears success notifications and redirects after the success timer', async () => {
    vi.useFakeTimers();
    const mockRouterPush = vi.fn();
    const { container } = render(<ContactForm />, { mockRouterPush });

    fireEvent.change(container.querySelector('#name'), { target: { value: 'Petya' } });
    fireEvent.change(container.querySelector('#email'), { target: { value: 'petya@example.com' } });
    fireEvent.change(container.querySelector('#message'), { target: { value: 'Hello there' } });
    fireEvent.submit(container.querySelector('form'));

    await act(async () => {
      await Promise.resolve();
    });
    expect(sendContactForm).toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(mockRouterPush).toHaveBeenCalledWith('/products');
  });

  it('shows a connection error without redirecting when sending fails', async () => {
    sendContactForm.mockRejectedValueOnce(new Error('network'));
    const mockRouterPush = vi.fn();
    const { container } = render(<ContactForm />, { mockRouterPush });

    fireEvent.change(container.querySelector('#name'), { target: { value: 'Petya' } });
    fireEvent.change(container.querySelector('#email'), { target: { value: 'petya@example.com' } });
    fireEvent.change(container.querySelector('#message'), { target: { value: 'Hello there' } });
    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => expect(sendContactForm).toHaveBeenCalled());

    expect(mockRouterPush).not.toHaveBeenCalled();
    await waitFor(() => expect(container.textContent).toContain('Проблеми'));
  });
});
