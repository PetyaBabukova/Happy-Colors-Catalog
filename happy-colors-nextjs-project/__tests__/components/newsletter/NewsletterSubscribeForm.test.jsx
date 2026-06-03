import { beforeEach, describe, expect, it, vi } from 'vitest';
import NewsletterSubscribeForm from '@/components/newsletter/NewsletterSubscribeForm';
import {
  getNewsletterSubscribeToken,
  subscribeToNewsletter,
} from '@/managers/newsletterManager';
import { fireEvent, render, screen, waitFor } from '../test-utils.jsx';

vi.mock('@/managers/newsletterManager', () => ({
  getNewsletterSubscribeToken: vi.fn(),
  subscribeToNewsletter: vi.fn(),
}));

const successMessage = 'Успешно се абонирахте.';

function fillValidForm(container, email = 'petya@example.com') {
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: email },
  });
  fireEvent.change(container.querySelector('input[name="website"]'), {
    target: { value: '' },
  });
  fireEvent.click(screen.getByRole('checkbox'));
}

describe('NewsletterSubscribeForm', () => {
  beforeEach(() => {
    vi.useRealTimers();
    getNewsletterSubscribeToken.mockResolvedValue({ token: 'form-token-1' });
    subscribeToNewsletter.mockResolvedValue({ message: successMessage });
  });

  it('requires email and consent before submitting', () => {
    const { container } = render(<NewsletterSubscribeForm />);

    fireEvent.submit(container.querySelector('form'));

    expect(subscribeToNewsletter).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Моля, въведете email адрес.');

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'petya@example.com' },
    });
    fireEvent.submit(container.querySelector('form'));

    expect(subscribeToNewsletter).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Моля, потвърдете съгласието си за получаване на новини.'
    );
  });

  it('submits the email, consent, honeypot, and form token then clears the form', async () => {
    const { container } = render(<NewsletterSubscribeForm />);
    const emailInput = screen.getByLabelText('Email');
    const consentInput = screen.getByRole('checkbox');

    fillValidForm(container);
    fireEvent.submit(container.querySelector('form'));

    await waitFor(() =>
      expect(subscribeToNewsletter).toHaveBeenCalledWith({
        email: 'petya@example.com',
        consent: true,
        website: '',
        formToken: 'form-token-1',
      })
    );

    expect(screen.getByRole('status')).toHaveTextContent(successMessage);
    expect(emailInput).toHaveValue('');
    expect(consentInput).not.toBeChecked();
  });

  it('keeps the form values and shows backend errors when submit fails', async () => {
    subscribeToNewsletter.mockRejectedValueOnce(new Error('Too many attempts'));
    const { container } = render(<NewsletterSubscribeForm />);

    fillValidForm(container);
    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => expect(subscribeToNewsletter).toHaveBeenCalled());

    expect(screen.getByRole('status')).toHaveTextContent('Too many attempts');
    expect(screen.getByLabelText('Email')).toHaveValue('petya@example.com');
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('shows duplicate subscription responses with success styling', async () => {
    subscribeToNewsletter.mockResolvedValueOnce({ message: successMessage });
    const { container } = render(<NewsletterSubscribeForm />);

    fillValidForm(container);
    fireEvent.submit(container.querySelector('form'));

    const status = await screen.findByRole('status');

    expect(status).toHaveTextContent(successMessage);
    expect(status.className).toContain('successMessage');
  });

  it('refreshes stale tokens and retries once', async () => {
    getNewsletterSubscribeToken.mockReset();
    getNewsletterSubscribeToken
      .mockResolvedValueOnce({ token: 'expired-token' })
      .mockResolvedValue({ token: 'fresh-token' });
    subscribeToNewsletter
      .mockRejectedValueOnce(Object.assign(new Error('expired'), { code: 'expired_form_token' }))
      .mockResolvedValueOnce({ message: successMessage });
    const { container } = render(<NewsletterSubscribeForm />);

    await waitFor(() => expect(getNewsletterSubscribeToken).toHaveBeenCalledTimes(1));

    fillValidForm(container);
    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => expect(subscribeToNewsletter).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(subscribeToNewsletter).toHaveBeenCalledTimes(2));
    expect(subscribeToNewsletter).toHaveBeenLastCalledWith(
      expect.objectContaining({ formToken: 'fresh-token' })
    );
  });

  it('retries too-new tokens once with the same token', async () => {
    subscribeToNewsletter
      .mockRejectedValueOnce(Object.assign(new Error('too new'), { code: 'too_new_form_token' }))
      .mockResolvedValueOnce({ message: successMessage });
    const { container } = render(<NewsletterSubscribeForm />);

    await waitFor(() => expect(getNewsletterSubscribeToken).toHaveBeenCalledTimes(1));

    fillValidForm(container);
    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => expect(subscribeToNewsletter).toHaveBeenCalledTimes(2));
    expect(subscribeToNewsletter.mock.calls[0][0].formToken).toBe('form-token-1');
    expect(subscribeToNewsletter.mock.calls[1][0].formToken).toBe('form-token-1');
  });

  it('includes a hidden honeypot field', () => {
    const { container } = render(<NewsletterSubscribeForm />);
    const honeypot = container.querySelector('input[name="website"]');

    expect(honeypot).toBeInTheDocument();
    expect(honeypot).toHaveAttribute('aria-hidden', 'true');
    expect(honeypot).toHaveAttribute('tabindex', '-1');
  });
});
