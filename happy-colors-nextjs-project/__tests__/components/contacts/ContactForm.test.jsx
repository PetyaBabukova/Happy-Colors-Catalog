import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ContactForm from '@/components/contacts/ContactForm';
import { sendContactForm } from '@/managers/contactsManager';
import {
  createCartoonOrder,
  createCartoonOrderUploadSession,
  uploadCartoonOrderPhoto,
} from '@/managers/cartoonOrdersManager';
import { act, fireEvent, render, screen, waitFor } from '../test-utils.jsx';

vi.mock('@/managers/contactsManager', () => ({
  sendContactForm: vi.fn(),
}));

vi.mock('@/managers/cartoonOrdersManager', () => ({
  createCartoonOrder: vi.fn(),
  createCartoonOrderUploadSession: vi.fn(),
  uploadCartoonOrderPhoto: vi.fn(),
}));

function fillContactFields(container, overrides = {}) {
  fireEvent.change(container.querySelector('#name'), {
    target: { value: overrides.name ?? ' Petya ' },
  });
  fireEvent.change(container.querySelector('#email'), {
    target: { value: overrides.email ?? 'petya@example.com' },
  });
  fireEvent.change(container.querySelector('#phone'), {
    target: { value: overrides.phone ?? ' +359888123456 ' },
  });
  fireEvent.change(container.querySelector('#message'), {
    target: { value: overrides.message ?? ' Cartoon idea. ' },
  });
}

function buildFile({ name = 'face.jpg', type = 'image/jpeg', size = 1024 } = {}) {
  return new File([new Uint8Array(size)], name, { type });
}

function uploadError(message, status, data = null) {
  const error = new Error(message);

  error.status = status;
  error.data = data;
  return error;
}

async function uploadPhoto(container, file = buildFile()) {
  fireEvent.change(container.querySelector('#cartoonPhotos'), {
    target: { files: [file] },
  });

  await waitFor(() => expect(uploadCartoonOrderPhoto).toHaveBeenCalled());
}

describe('ContactForm', () => {
  beforeEach(() => {
    sendContactForm.mockResolvedValue({ message: 'sent' });
    createCartoonOrder.mockResolvedValue({ message: 'created', orderId: 'order-1' });
    createCartoonOrderUploadSession.mockResolvedValue({
      uploadSessionToken: 'session-token',
    });
    uploadCartoonOrderPhoto.mockImplementation(({ file }) => Promise.resolve({
      objectName: `cartoon-orders/reference-photos/${file.name}`,
      uploadConfirmationToken: `confirmation-${file.name}`,
      originalName: file.name,
      contentType: file.type,
      size: file.size,
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('validates required fields before sending', () => {
    const { container } = render(<ContactForm />);

    fireEvent.submit(container.querySelector('form'));

    expect(sendContactForm).not.toHaveBeenCalled();
    expect(createCartoonOrder).not.toHaveBeenCalled();
    expect(container.querySelector('#name').className).not.toBe('');
    expect(container.querySelector('#email').className).not.toBe('');
    expect(container.querySelector('#message').className).not.toBe('');
  });

  it('sends a sanitized product enquiry payload and resets the form', async () => {
    const product = { _id: 'product-1', title: 'Lavender Candle' };
    const { container } = render(<ContactForm product={product} />);

    fillContactFields(container, { message: ' Please call me. ' });
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
    expect(createCartoonOrder).not.toHaveBeenCalled();
    expect(screen.getAllByText(/Lavender Candle/).length).toBeGreaterThan(0);
    expect(container.querySelector('#name')).toHaveValue('');
    expect(container.querySelector('#message')).toHaveValue('');
  });

  it('keeps normal contact mode free of cartoon upload controls and uses the 1000-character limit', () => {
    const { container } = render(<ContactForm />);

    expect(container.querySelector('#cartoonPhotos')).not.toBeInTheDocument();
    expect(container.querySelector('#cartoonConsent')).not.toBeInTheDocument();
    expect(container.querySelector('#message')).toHaveAttribute('maxlength', '1000');
    expect(container.textContent).toContain('1000');
  });

  it('rejects normal contact messages over the 1000-character limit', async () => {
    const { container } = render(<ContactForm />);

    fillContactFields(container, { message: 'x'.repeat(1001) });
    fireEvent.submit(container.querySelector('form'));

    expect(sendContactForm).not.toHaveBeenCalled();
    await waitFor(() => expect(container.querySelector('#message').className).not.toBe(''));
  });

  it('shows cartoon upload controls only in cartoon mode and keeps product title/url out of the order payload', async () => {
    const product = { _id: 'product-1', title: 'Cartoon Sample' };
    const { container } = render(<ContactForm product={product} serviceContext="cartoons" />);

    expect(container.querySelector('#message')).toHaveAttribute('maxlength', '1500');
    expect(container.querySelector('#cartoonPhotos')).toBeInTheDocument();
    expect(container.querySelector('#cartoonConsent')).toBeInTheDocument();
    expect(container.textContent).not.toContain('Изпращате запитване за: Cartoon Sample');

    fillContactFields(container);
    await uploadPhoto(container);
    fireEvent.click(container.querySelector('#cartoonConsent'));
    fireEvent.submit(container.querySelector('form'));

    await waitFor(() =>
      expect(createCartoonOrder).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Petya',
        email: 'petya@example.com',
        phone: '+359888123456',
        message: 'Cartoon idea.',
        productId: 'product-1',
        consentAccepted: true,
        website: '',
      }))
    );
    expect(createCartoonOrder.mock.calls[0][0]).not.toHaveProperty('productTitle');
    expect(createCartoonOrder.mock.calls[0][0]).not.toHaveProperty('productUrl');
    expect(sendContactForm).not.toHaveBeenCalled();
  });

  it('requires consent only for cartoon order submission', async () => {
    const { container } = render(
      <ContactForm product={{ _id: 'product-1', title: 'Cartoon Sample' }} serviceContext="cartoons" />
    );

    fillContactFields(container);
    await uploadPhoto(container);
    fireEvent.submit(container.querySelector('form'));

    expect(createCartoonOrder).not.toHaveBeenCalled();
    await waitFor(() => expect(container.textContent).toContain('съгласието'));
  });

  it('requires an uploaded cartoon photo before order submission', async () => {
    const { container } = render(
      <ContactForm product={{ _id: 'product-1', title: 'Cartoon Sample' }} serviceContext="cartoons" />
    );

    fillContactFields(container);
    fireEvent.click(container.querySelector('#cartoonConsent'));
    fireEvent.submit(container.querySelector('form'));

    expect(createCartoonOrder).not.toHaveBeenCalled();
    expect(uploadCartoonOrderPhoto).not.toHaveBeenCalled();
    await waitFor(() => expect(container.textContent).toContain('поне една'));
  });

  it('blocks cartoon order submission when no productId is available', async () => {
    const { container } = render(<ContactForm serviceContext="cartoons" />);

    fillContactFields(container);
    await uploadPhoto(container);
    fireEvent.click(container.querySelector('#cartoonConsent'));
    fireEvent.submit(container.querySelector('form'));

    expect(createCartoonOrder).not.toHaveBeenCalled();
    await waitFor(() => expect(container.textContent).toContain('конкретен'));
  });

  it('rejects more than five selected cartoon photos before upload', async () => {
    const { container } = render(<ContactForm serviceContext="cartoons" />);
    const files = Array.from({ length: 6 }, (_, index) => buildFile({ name: `face-${index}.jpg` }));

    fireEvent.change(container.querySelector('#cartoonPhotos'), {
      target: { files },
    });

    expect(createCartoonOrderUploadSession).not.toHaveBeenCalled();
    expect(uploadCartoonOrderPhoto).not.toHaveBeenCalled();
    await waitFor(() => expect(container.textContent).toContain('до 5'));
  });

  it('rejects unsupported cartoon photo types before upload', async () => {
    const { container } = render(<ContactForm serviceContext="cartoons" />);

    fireEvent.change(container.querySelector('#cartoonPhotos'), {
      target: { files: [buildFile({ name: 'notes.txt', type: 'text/plain' })] },
    });

    expect(uploadCartoonOrderPhoto).not.toHaveBeenCalled();
    await waitFor(() => expect(container.textContent).toContain('JPG'));
  });

  it('rejects cartoon photos larger than 3MB before upload', async () => {
    const { container } = render(<ContactForm serviceContext="cartoons" />);

    fireEvent.change(container.querySelector('#cartoonPhotos'), {
      target: { files: [buildFile({ size: 3 * 1024 * 1024 + 1 })] },
    });

    expect(uploadCartoonOrderPhoto).not.toHaveBeenCalled();
    await waitFor(() => expect(container.textContent).toContain('3 MB'));
  });

  it('stores uploaded cartoon photo metadata and sends it in the order payload', async () => {
    const { container } = render(
      <ContactForm product={{ _id: 'product-1', title: 'Cartoon Sample' }} serviceContext="cartoons" />
    );
    const file = buildFile({ name: 'reference.webp', type: 'image/webp', size: 2048 });

    fillContactFields(container);
    await uploadPhoto(container, file);

    expect(createCartoonOrderUploadSession).toHaveBeenCalledTimes(1);
    expect(uploadCartoonOrderPhoto).toHaveBeenCalledWith({
      file,
      uploadSessionToken: 'session-token',
    });
    expect(container.textContent).toContain('reference.webp');

    fireEvent.click(container.querySelector('#cartoonConsent'));
    fireEvent.submit(container.querySelector('form'));

    await waitFor(() =>
      expect(createCartoonOrder).toHaveBeenCalledWith(expect.objectContaining({
        photos: [
          {
            objectName: 'cartoon-orders/reference-photos/reference.webp',
            uploadConfirmationToken: 'confirmation-reference.webp',
            originalName: 'reference.webp',
            contentType: 'image/webp',
            size: 2048,
          },
        ],
      }))
    );
  });

  it('removes an uploaded pending cartoon photo from the submitted payload', async () => {
    const { container } = render(
      <ContactForm product={{ _id: 'product-1', title: 'Cartoon Sample' }} serviceContext="cartoons" />
    );

    fillContactFields(container);
    await uploadPhoto(container, buildFile({ name: 'first.jpg' }));
    await uploadPhoto(container, buildFile({ name: 'second.jpg' }));

    fireEvent.click(container.querySelectorAll('button[type="button"]')[0]);
    fireEvent.click(container.querySelector('#cartoonConsent'));
    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => expect(createCartoonOrder).toHaveBeenCalled());
    expect(createCartoonOrder.mock.calls[0][0].photos).toEqual([
      expect.objectContaining({ originalName: 'second.jpg' }),
    ]);
  });

  it('keeps uploaded photos when cartoon order submission fails', async () => {
    createCartoonOrder.mockRejectedValueOnce(new Error('backend validation'));
    const { container } = render(
      <ContactForm product={{ _id: 'product-1', title: 'Cartoon Sample' }} serviceContext="cartoons" />
    );

    fillContactFields(container);
    await uploadPhoto(container, buildFile({ name: 'keep.jpg' }));
    fireEvent.click(container.querySelector('#cartoonConsent'));
    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => expect(createCartoonOrder).toHaveBeenCalled());
    expect(container.textContent).toContain('keep.jpg');
  });

  it('clears uploaded photos and prompts re-upload when cartoon order submission rejects stale photos', async () => {
    createCartoonOrder.mockRejectedValueOnce(uploadError('Upload session is expired or missing.', 409));
    const { container } = render(
      <ContactForm product={{ _id: 'product-1', title: 'Cartoon Sample' }} serviceContext="cartoons" />
    );

    fillContactFields(container);
    await uploadPhoto(container, buildFile({ name: 'stale.jpg' }));
    fireEvent.click(container.querySelector('#cartoonConsent'));
    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => expect(createCartoonOrder).toHaveBeenCalled());
    await waitFor(() => expect(container.textContent).toContain('качете ги отново'));
    expect(container.textContent).not.toContain('stale.jpg');
  });

  it('clears stale cartoon uploads when the upload session expires', async () => {
    uploadCartoonOrderPhoto.mockRejectedValueOnce(
      uploadError('Upload session is expired. Please select the photos again.', 409, {
        code: 'upload_session_expired',
      })
    );
    const { container } = render(<ContactForm serviceContext="cartoons" />);

    fireEvent.change(container.querySelector('#cartoonPhotos'), {
      target: { files: [buildFile({ name: 'expired.jpg' })] },
    });

    await waitFor(() => expect(container.textContent).toContain('поднови'));
    expect(container.querySelector('[data-testid="cartoon-photo-list"]')).not.toBeInTheDocument();
  });

  it('clears stale cartoon uploads when the server session is already full', async () => {
    uploadCartoonOrderPhoto.mockRejectedValueOnce(
      uploadError('Upload session already contains the maximum number of photos.', 409, {
        code: 'upload_session_full',
      })
    );
    const { container } = render(<ContactForm serviceContext="cartoons" />);

    fireEvent.change(container.querySelector('#cartoonPhotos'), {
      target: { files: [buildFile({ name: 'extra.jpg' })] },
    });

    await waitFor(() => expect(container.textContent).toContain('поднови'));
    expect(container.querySelector('[data-testid="cartoon-photo-list"]')).not.toBeInTheDocument();
  });

  it('keeps existing cartoon photos when a later upload fails as a duplicate', async () => {
    const { container } = render(<ContactForm serviceContext="cartoons" />);

    await uploadPhoto(container, buildFile({ name: 'keep.jpg' }));
    uploadCartoonOrderPhoto.mockRejectedValueOnce(
      uploadError('This photo has already been uploaded in the current session.', 409, {
        code: 'upload_session_duplicate',
      })
    );

    fireEvent.change(container.querySelector('#cartoonPhotos'), {
      target: { files: [buildFile({ name: 'duplicate.jpg' })] },
    });

    await waitFor(() => {
      expect(container.textContent).toContain('вече е качена');
      expect(container.textContent).toContain('keep.jpg');
    });
  });

  it('does not free server upload slots when a pending cartoon photo is removed locally', async () => {
    const { container } = render(<ContactForm serviceContext="cartoons" />);
    const files = Array.from({ length: 5 }, (_, index) => (
      buildFile({ name: `face-${index}.jpg` })
    ));

    fireEvent.change(container.querySelector('#cartoonPhotos'), {
      target: { files },
    });

    await waitFor(() => expect(container.textContent).toContain('face-4.jpg'));

    fireEvent.click(container.querySelectorAll('button[type="button"]')[0]);

    expect(container.textContent).not.toContain('face-0.jpg');
    expect(container.querySelector('#cartoonPhotos')).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Избери снимките отново' }));

    expect(container.querySelector('[data-testid="cartoon-photo-list"]')).not.toBeInTheDocument();
    expect(container.querySelector('#cartoonPhotos')).not.toBeDisabled();
  });

  it('does not send forbidden markup', async () => {
    const { container } = render(<ContactForm />);

    fillContactFields(container, { message: '<b>Hello</b>' });
    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => {
      expect(container.textContent).toMatch(/забранени/i);
      expect(sendContactForm).not.toHaveBeenCalled();
    });
  });

  it('clears normal contact success notifications and redirects after the success timer', async () => {
    vi.useFakeTimers();
    const mockRouterPush = vi.fn();
    const { container } = render(<ContactForm />, { mockRouterPush });

    fillContactFields(container, { phone: '', message: 'Hello there' });
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

  it('does not redirect cartoon order success to products', async () => {
    const mockRouterPush = vi.fn();
    const { container } = render(
      <ContactForm product={{ _id: 'product-1', title: 'Cartoon Sample' }} serviceContext="cartoons" />,
      { mockRouterPush }
    );

    fillContactFields(container, { phone: '', message: 'Cartoon brief' });
    await uploadPhoto(container);
    vi.useFakeTimers();
    fireEvent.click(container.querySelector('#cartoonConsent'));
    fireEvent.submit(container.querySelector('form'));

    await act(async () => {
      await Promise.resolve();
    });
    expect(createCartoonOrder).toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(mockRouterPush).not.toHaveBeenCalledWith('/products');
  });

  it('shows a connection error without redirecting when normal contact sending fails', async () => {
    sendContactForm.mockRejectedValueOnce(new Error('network'));
    const mockRouterPush = vi.fn();
    const { container } = render(<ContactForm />, { mockRouterPush });

    fillContactFields(container, { phone: '', message: 'Hello there' });
    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => expect(sendContactForm).toHaveBeenCalled());

    expect(mockRouterPush).not.toHaveBeenCalled();
    await waitFor(() => expect(container.textContent).toContain('Проблеми'));
  });

  it('shows backend conflict messages for normal contact 409 responses', async () => {
    const conflictError = new Error('Conflict message');

    conflictError.status = 409;
    sendContactForm.mockRejectedValueOnce(conflictError);
    const { container } = render(<ContactForm />);

    fillContactFields(container, { phone: '', message: 'Hello there' });
    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => expect(sendContactForm).toHaveBeenCalled());
    await waitFor(() => expect(container.textContent).toContain('Conflict message'));
  });
});
