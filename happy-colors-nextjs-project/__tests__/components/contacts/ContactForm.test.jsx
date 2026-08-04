import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ContactForm from '@/components/contacts/ContactForm';
import { sendContactForm } from '@/managers/contactsManager';
import {
  createCartoonOrder,
  createCartoonOrderUploadSession,
  cleanupCartoonOrderUploadedPhotos,
  uploadCartoonOrderPhoto,
} from '@/managers/cartoonOrdersManager';
import { act, fireEvent, render, screen, waitFor } from '../test-utils.jsx';
import { setMockNavigation } from '../setup.js';

vi.mock('@/managers/contactsManager', () => ({
  sendContactForm: vi.fn(),
}));

vi.mock('@/managers/cartoonOrdersManager', () => ({
  createCartoonOrder: vi.fn(),
  createCartoonOrderUploadSession: vi.fn(),
  cleanupCartoonOrderUploadedPhotos: vi.fn(),
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

function getPhotoItems(container) {
  return Array.from(container.querySelectorAll('[data-photo-status]'));
}

function getResetPhotosButton(container) {
  return Array.from(container.querySelectorAll('button[type="button"]'))
    .find((button) => button.textContent.includes('Избери'));
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
    cleanupCartoonOrderUploadedPhotos.mockResolvedValue({
      deletedCount: 1,
      failedCount: 0,
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
    vi.unstubAllEnvs();
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

  it('renders normal contact form copy in English', () => {
    const { container } = render(<ContactForm product={{ _id: 'product-1', title: 'Lavender Candle' }} />, {
      locale: 'en',
    });

    expect(screen.getByRole('heading', { name: 'Contact us' })).toBeInTheDocument();
    expect(screen.getByText(/You are sending an inquiry about:/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
    expect(screen.getByLabelText('Phone')).toBeInTheDocument();
    expect(screen.getByLabelText(/Message/)).toBeInTheDocument();
    expect(screen.getByText('The name must be between 3 and 20 characters.')).toBeInTheDocument();
    expect(screen.getByText('Your message must not exceed 1000 characters.')).toBeInTheDocument();
    expect(container.textContent).not.toContain('Свържете се с нас');
  });

  it('renders cartoon inquiry copy in English', () => {
    render(<ContactForm serviceContext="cartoons" />, { locale: 'en' });

    expect(screen.getByRole('heading', { name: 'Caricature inquiry' })).toBeInTheDocument();
    expect(screen.getByText(/Send an inquiry. We will contact you/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Reference photos/)).toBeInTheDocument();
    expect(screen.getByText(/Describe the caricature you imagine/)).toBeInTheDocument();
    expect(screen.getByText(/Up to 5 photos, each up to 3 MB/)).toBeInTheDocument();
    expect(screen.getByText(/I agree that the uploaded photos/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
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
    expect(container.querySelector('button[type="submit"]')).toBeDisabled();
    expect(container.textContent).toContain(
      'Изпратете запитване. Ще се свържем с вас за уточнение на цена, срок, вариант и начин на изработка.'
    );
    expect(container.textContent).toContain(
      'Съгласявам се качените снимки да бъдат използвани единствено за разглеждане на запитването и изготвяне на индивидуална оферта за шарж.'
    );
    expect(container.textContent).not.toContain('Изпращате запитване за: Cartoon Sample');

    fillContactFields(container);
    await uploadPhoto(container);
    fireEvent.click(container.querySelector('#cartoonConsent'));
    expect(container.querySelector('button[type="submit"]')).not.toBeDisabled();
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

  it('keeps the cartoon submit button disabled until required fields, photo, and consent are ready', async () => {
    const { container } = render(<ContactForm serviceContext="cartoons" />);
    const submitButton = container.querySelector('button[type="submit"]');

    expect(submitButton).toBeDisabled();

    fillContactFields(container);
    expect(submitButton).toBeDisabled();

    await uploadPhoto(container);
    expect(submitButton).toBeDisabled();

    fireEvent.click(container.querySelector('#cartoonConsent'));
    expect(submitButton).not.toBeDisabled();

    fireEvent.change(container.querySelector('#message'), {
      target: { value: '   ' },
    });
    expect(submitButton).toBeDisabled();
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

  it('submits a general cartoon inquiry without a specific product', async () => {
    const { container } = render(<ContactForm serviceContext="cartoons" />);

    fillContactFields(container);
    await uploadPhoto(container);
    fireEvent.click(container.querySelector('#cartoonConsent'));
    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => expect(createCartoonOrder).toHaveBeenCalled());
    expect(createCartoonOrder.mock.calls[0][0]).toMatchObject({ productId: null });
  });

  it('redirects successful cartoon enquiries back to cartoons after the success message', async () => {
    const { container, mockRouterPush } = render(<ContactForm serviceContext="cartoons" />);

    fillContactFields(container);
    await uploadPhoto(container);
    fireEvent.click(container.querySelector('#cartoonConsent'));
    vi.useFakeTimers();

    await act(async () => {
      fireEvent.submit(container.querySelector('form'));
      await Promise.resolve();
    });

    expect(createCartoonOrder).toHaveBeenCalled();
    expect(cleanupCartoonOrderUploadedPhotos).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Благодарим');
    expect(mockRouterPush).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(mockRouterPush).toHaveBeenCalledWith('/cartoons');
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
    expect(container.textContent).not.toContain('cartoon-orders/reference-photos/reference.webp');
    expect(getPhotoItems(container)[0]).toHaveAttribute('data-photo-status', 'uploaded');
    expect(container.textContent).toContain('Качена');

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
    expect(createCartoonOrder.mock.calls[0][0].photos[0]).toMatchObject({
      objectName: 'cartoon-orders/reference-photos/reference.webp',
      uploadConfirmationToken: 'confirmation-reference.webp',
    });
  });

  it('removes an uploaded pending cartoon photo from the submitted payload', async () => {
    const { container } = render(
      <ContactForm product={{ _id: 'product-1', title: 'Cartoon Sample' }} serviceContext="cartoons" />
    );

    fillContactFields(container);
    await uploadPhoto(container, buildFile({ name: 'first.jpg' }));
    await uploadPhoto(container, buildFile({ name: 'second.jpg' }));

    fireEvent.click(container.querySelectorAll('button[type="button"]')[0]);
    await waitFor(() => expect(cleanupCartoonOrderUploadedPhotos).toHaveBeenCalledWith({
      uploadSessionToken: 'session-token',
      uploadConfirmationTokens: ['confirmation-first.jpg'],
    }));
    await waitFor(() => expect(container.textContent).not.toContain('first.jpg'));
    fireEvent.click(container.querySelector('#cartoonConsent'));
    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => expect(createCartoonOrder).toHaveBeenCalled());
    expect(createCartoonOrder.mock.calls[0][0].photos).toEqual([
      expect.objectContaining({ originalName: 'second.jpg' }),
    ]);
    expect(createCartoonOrder.mock.calls[0][0].photos).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ originalName: 'first.jpg' })])
    );
  });

  it('disables final submit while cartoon photos are uploading', async () => {
    let resolveUpload;
    uploadCartoonOrderPhoto.mockReturnValueOnce(new Promise((resolve) => {
      resolveUpload = resolve;
    }));
    const { container } = render(<ContactForm serviceContext="cartoons" />);

    fireEvent.change(container.querySelector('#cartoonPhotos'), {
      target: { files: [buildFile({ name: 'slow.jpg' })] },
    });

    await waitFor(() => expect(container.textContent).toContain('Качване'));
    expect(container.querySelector('button[type="submit"]')).toBeDisabled();

    await act(async () => {
      resolveUpload({
        objectName: 'cartoon-orders/reference-photos/slow.jpg',
        uploadConfirmationToken: 'confirmation-slow.jpg',
        originalName: 'slow.jpg',
        contentType: 'image/jpeg',
        size: 1024,
      });
    });

    await waitFor(() => expect(container.querySelector('button[type="submit"]')).toBeDisabled());
    fillContactFields(container);
    fireEvent.click(container.querySelector('#cartoonConsent'));
    expect(container.querySelector('button[type="submit"]')).not.toBeDisabled();
  });

  it('keeps successful uploads and marks only failed files when a multi-file selection partially fails', async () => {
    uploadCartoonOrderPhoto
      .mockResolvedValueOnce({
        objectName: 'cartoon-orders/reference-photos/ok.jpg',
        uploadConfirmationToken: 'confirmation-ok.jpg',
        originalName: 'ok.jpg',
        contentType: 'image/jpeg',
        size: 1024,
      })
      .mockRejectedValueOnce(uploadError('Second file failed.', 500));
    const { container } = render(<ContactForm serviceContext="cartoons" />);

    fillContactFields(container);
    fireEvent.change(container.querySelector('#cartoonPhotos'), {
      target: {
        files: [
          buildFile({ name: 'ok.jpg' }),
          buildFile({ name: 'failed.jpg' }),
        ],
      },
    });

    await waitFor(() => expect(container.textContent).toContain('Second file failed.'));
    const items = getPhotoItems(container);

    expect(items[0]).toHaveAttribute('data-photo-status', 'uploaded');
    expect(items[1]).toHaveAttribute('data-photo-status', 'failed');

    fireEvent.click(container.querySelector('#cartoonConsent'));
    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => expect(createCartoonOrder).toHaveBeenCalled());
    expect(createCartoonOrder.mock.calls[0][0].photos).toEqual([
      expect.objectContaining({ originalName: 'ok.jpg' }),
    ]);
  });

  it('retries a failed cartoon photo upload', async () => {
    uploadCartoonOrderPhoto
      .mockRejectedValueOnce(uploadError('Temporary upload error.', 500))
      .mockResolvedValueOnce({
        objectName: 'cartoon-orders/reference-photos/retry.jpg',
        uploadConfirmationToken: 'confirmation-retry.jpg',
        originalName: 'retry.jpg',
        contentType: 'image/jpeg',
        size: 1024,
      });
    const { container } = render(<ContactForm serviceContext="cartoons" />);

    fireEvent.change(container.querySelector('#cartoonPhotos'), {
      target: { files: [buildFile({ name: 'retry.jpg' })] },
    });

    await waitFor(() => expect(getPhotoItems(container)[0]).toHaveAttribute('data-photo-status', 'failed'));

    fireEvent.click(screen.getByRole('button', { name: 'Опитай пак' }));

    await waitFor(() => expect(getPhotoItems(container)[0]).toHaveAttribute('data-photo-status', 'uploaded'));
    expect(uploadCartoonOrderPhoto).toHaveBeenCalledTimes(2);
  });

  it('keeps an uploaded cartoon photo retryable when cleanup removal fails', async () => {
    cleanupCartoonOrderUploadedPhotos.mockRejectedValueOnce(new Error('cleanup failed'));
    const { container } = render(<ContactForm serviceContext="cartoons" />);

    await uploadPhoto(container, buildFile({ name: 'cleanup-fails.jpg' }));

    fireEvent.click(container.querySelectorAll('button[type="button"]')[0]);

    await waitFor(() => expect(cleanupCartoonOrderUploadedPhotos).toHaveBeenCalled());
    await waitFor(() => {
      expect(container.textContent).toContain('cleanup-fails.jpg');
      expect(getPhotoItems(container)[0]).toHaveAttribute('data-photo-status', 'uploaded');
      expect(container.textContent).toContain('Снимката не можа да бъде премахната');
    });
  });

  it('blocks submit when all cartoon photos are failed or removed', async () => {
    uploadCartoonOrderPhoto.mockRejectedValueOnce(uploadError('Upload failed.', 500));
    const { container } = render(<ContactForm serviceContext="cartoons" />);

    fillContactFields(container);
    fireEvent.change(container.querySelector('#cartoonPhotos'), {
      target: { files: [buildFile({ name: 'failed-only.jpg' })] },
    });

    await waitFor(() => expect(getPhotoItems(container)[0]).toHaveAttribute('data-photo-status', 'failed'));
    fireEvent.click(container.querySelector('#cartoonConsent'));
    fireEvent.submit(container.querySelector('form'));

    expect(createCartoonOrder).not.toHaveBeenCalled();
    await waitFor(() => expect(container.textContent).toContain('поне една'));
  });

  it('does not show storage object names when uploaded metadata has no original name', async () => {
    uploadCartoonOrderPhoto.mockResolvedValueOnce({
      objectName: 'cartoon-orders/reference-photos/private-object-name.jpg',
      uploadConfirmationToken: 'confirmation-private',
      contentType: 'image/jpeg',
      size: 1024,
    });
    const { container } = render(<ContactForm serviceContext="cartoons" />);

    await uploadPhoto(container, buildFile({ name: '' }));

    expect(container.textContent).toContain('Снимка');
    expect(container.textContent).not.toContain('private-object-name.jpg');
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
    expect(getPhotoItems(container)[0]).toHaveAttribute('data-photo-status', 'stale');
    expect(container.textContent).toContain('stale.jpg');

    fireEvent.submit(container.querySelector('form'));

    expect(createCartoonOrder).toHaveBeenCalledTimes(1);
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
    expect(getPhotoItems(container)[0]).toHaveAttribute('data-photo-status', 'stale');
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
    expect(getPhotoItems(container)[0]).toHaveAttribute('data-photo-status', 'stale');
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

  it('cleans up a pending cartoon photo before freeing its upload slot', async () => {
    const { container } = render(<ContactForm serviceContext="cartoons" />);
    const files = Array.from({ length: 5 }, (_, index) => (
      buildFile({ name: `face-${index}.jpg` })
    ));

    fireEvent.change(container.querySelector('#cartoonPhotos'), {
      target: { files },
    });

    await waitFor(() => expect(container.textContent).toContain('face-4.jpg'));

    fireEvent.click(container.querySelectorAll('button[type="button"]')[0]);

    await waitFor(() => expect(cleanupCartoonOrderUploadedPhotos).toHaveBeenCalledWith({
      uploadSessionToken: 'session-token',
      uploadConfirmationTokens: ['confirmation-face-0.jpg'],
    }));
    await waitFor(() => expect(container.textContent).not.toContain('face-0.jpg'));
    expect(container.querySelector('#cartoonPhotos')).not.toBeDisabled();

    fireEvent.click(getResetPhotosButton(container));

    await waitFor(() => expect(cleanupCartoonOrderUploadedPhotos).toHaveBeenCalledTimes(2));
    expect(cleanupCartoonOrderUploadedPhotos.mock.calls[1][0]).toMatchObject({
      uploadSessionToken: 'session-token',
      uploadConfirmationTokens: [
        'confirmation-face-1.jpg',
        'confirmation-face-2.jpg',
        'confirmation-face-3.jpg',
        'confirmation-face-4.jpg',
      ],
    });
    await waitFor(() =>
      expect(container.querySelector('[data-testid="cartoon-photo-list"]')).not.toBeInTheDocument()
    );
    expect(container.querySelector('#cartoonPhotos')).not.toBeDisabled();
  });

  it('clears local cartoon photos after partial reset cleanup progress', async () => {
    const partialCleanupError = uploadError('partial cleanup', 409, {
      deletedCount: 1,
      failedCount: 1,
    });

    cleanupCartoonOrderUploadedPhotos.mockRejectedValueOnce(partialCleanupError);
    const { container } = render(<ContactForm serviceContext="cartoons" />);

    fireEvent.change(container.querySelector('#cartoonPhotos'), {
      target: {
        files: [
          buildFile({ name: 'partial-a.jpg' }),
          buildFile({ name: 'partial-b.jpg' }),
        ],
      },
    });

    await waitFor(() => expect(container.textContent).toContain('partial-b.jpg'));

    fireEvent.click(getResetPhotosButton(container));

    await waitFor(() => expect(cleanupCartoonOrderUploadedPhotos).toHaveBeenCalledWith({
      uploadSessionToken: 'session-token',
      uploadConfirmationTokens: [
        'confirmation-partial-a.jpg',
        'confirmation-partial-b.jpg',
      ],
    }));
    await waitFor(() =>
      expect(container.querySelector('[data-testid="cartoon-photo-list"]')).not.toBeInTheDocument()
    );
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

  it('keeps successful contact redirects in the active public locale without changing backend product URLs', async () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');
    setMockNavigation({ pathname: '/en/contacts' });
    vi.useFakeTimers();
    const mockRouterPush = vi.fn();
    const { container } = render(
      <ContactForm product={{ _id: 'product-1', title: 'Lavender Candle' }} />,
      { mockRouterPush }
    );

    fillContactFields(container, { phone: '', message: 'Hello there' });
    await act(async () => {
      fireEvent.submit(container.querySelector('form'));
      await Promise.resolve();
    });

    expect(sendContactForm).toHaveBeenCalledWith(expect.objectContaining({
      productUrl: `${window.location.origin}/products/product-1`,
    }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(mockRouterPush).toHaveBeenCalledWith('/en/products');
  });

  it('submits cartoon order inquiries with the active public locale', async () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');
    setMockNavigation({ pathname: '/en/contacts' });
    const { container } = render(<ContactForm serviceContext="cartoons" />);

    fillContactFields(container, { phone: '', message: 'Cartoon brief' });
    await uploadPhoto(container);
    fireEvent.click(container.querySelector('#cartoonConsent'));
    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => expect(createCartoonOrder).toHaveBeenCalled());
    expect(createCartoonOrder.mock.calls[0][0]).toMatchObject({
      productId: null,
      locale: 'en',
    });
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
