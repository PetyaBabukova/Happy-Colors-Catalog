import { beforeEach, describe, expect, it, vi } from 'vitest';
import NewsletterSendClient from '@/app/newsletter/send/NewsletterSendClient';
import {
  getBlogNewsletterPrefill,
  getProductNewsletterPrefill,
  getNewsletterSendStatus,
  sendNewsletterTest,
  sendNewsletterToSubscribers,
} from '@/managers/newsletterSendManager';
import { fireEvent, render, screen, waitFor } from '../test-utils.jsx';
import { setMockNavigation } from '../setup.js';

vi.mock('@/components/blog/RichTextEditor', () => ({
  default: ({ id, onChange }) => (
    <textarea
      id={id}
      aria-label="Съдържание"
      onChange={(event) =>
        onChange({
          contentHtml: `<p>${event.target.value}</p>`,
          contentJson: { type: 'doc', content: [{ type: 'paragraph' }] },
          contentText: event.target.value,
        })
      }
    />
  ),
}));

vi.mock('@/managers/newsletterSendManager', () => ({
  getBlogNewsletterPrefill: vi.fn(),
  getProductNewsletterPrefill: vi.fn(),
  getNewsletterSendStatus: vi.fn(),
  sendNewsletterTest: vi.fn(),
  sendNewsletterToSubscribers: vi.fn(),
}));

function fillForm() {
  fireEvent.change(screen.getByLabelText('Тема'), {
    target: { value: 'Новини от Happy Colors' },
  });
  fireEvent.change(screen.getByLabelText('Съдържание'), {
    target: { value: 'Ръчно изработени подаръци' },
  });
}

describe('NewsletterSendClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getNewsletterSendStatus.mockResolvedValue({
      activeSubscribers: 3,
      activeSubscribersByLocale: {
        bg: 2,
        en: 1,
      },
    });
    getProductNewsletterPrefill.mockResolvedValue({
      sourceType: 'product',
      sourceId: 'product-1',
      subject: 'Product newsletter',
      contentHtml: '<p>Product content</p>',
      contentText: 'Product content',
      imageUrl: 'https://cdn.example.com/product.webp',
      ctaUrl: '/products/product-1',
      ctaLabel: 'Виж повече',
    });
    getBlogNewsletterPrefill.mockResolvedValue({
      sourceType: 'blog',
      sourceId: 'article-1',
      subject: 'Blog newsletter',
      contentHtml: '<p>Blog content</p>',
      contentText: 'Blog content',
      imageUrl: 'https://cdn.example.com/blog.webp',
      ctaUrl: '/blog/article-1',
      ctaLabel: 'View more',
    });
    sendNewsletterTest.mockResolvedValue({ message: 'Test email sent.', recipients: 2 });
    sendNewsletterToSubscribers.mockResolvedValue({
      message: 'Newsletter send finished.',
      sent: 3,
      failed: 0,
      activeSubscribers: 3,
    });
  });

  it('validates required fields before sending', () => {
    render(<NewsletterSendClient />);

    fireEvent.click(screen.getByRole('button', { name: 'Изпрати тест' }));

    expect(screen.getByRole('status')).toHaveTextContent('Моля, въведете тема на имейла.');
    expect(sendNewsletterTest).not.toHaveBeenCalled();
  });

  it('sends optional test emails with custom payload data', async () => {
    render(<NewsletterSendClient />);
    fillForm();

    fireEvent.click(screen.getByRole('button', { name: 'Изпрати тест' }));

    await waitFor(() => expect(sendNewsletterTest).toHaveBeenCalled());
    expect(sendNewsletterTest).toHaveBeenCalledWith({
      subject: 'Новини от Happy Colors',
      contentHtml: '<p>Ръчно изработени подаръци</p>',
      contentJson: { type: 'doc', content: [{ type: 'paragraph' }] },
      contentText: 'Ръчно изработени подаръци',
      sourceType: 'custom',
      locales: ['bg', 'en'],
    });
    expect(screen.getByRole('status')).toHaveTextContent('Test email sent.');
  });

  it('opens a confirmation modal with active subscriber count before broadcast', async () => {
    render(<NewsletterSendClient />);
    fillForm();

    fireEvent.click(screen.getByRole('button', { name: 'Изпрати до абонати' }));

    await waitFor(() => expect(getNewsletterSendStatus).toHaveBeenCalled());
    expect(screen.getByRole('dialog')).toHaveTextContent('3 активни');
    expect(screen.getByRole('dialog')).toHaveTextContent('Български: 2');
    expect(screen.getByRole('dialog')).toHaveTextContent('English: 1');
    expect(sendNewsletterToSubscribers).not.toHaveBeenCalled();
  });

  it('cancels and confirms broadcast from the modal', async () => {
    render(<NewsletterSendClient />);
    fillForm();

    fireEvent.click(screen.getByRole('button', { name: 'Изпрати до абонати' }));
    await screen.findByRole('dialog');

    fireEvent.click(screen.getByRole('button', { name: 'Отказ' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(sendNewsletterToSubscribers).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Изпрати до абонати' }));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Потвърждавам' }));

    await waitFor(() => expect(sendNewsletterToSubscribers).toHaveBeenCalled());
    expect(sendNewsletterToSubscribers).toHaveBeenCalledWith(
      expect.objectContaining({
        locales: ['bg', 'en'],
      })
    );
    expect(screen.getByRole('status')).toHaveTextContent('Newsletter send finished.');
  });

  it('shows zero-subscriber state without opening the confirmation modal', async () => {
    getNewsletterSendStatus.mockResolvedValueOnce({
      activeSubscribers: 0,
      activeSubscribersByLocale: {
        bg: 0,
        en: 0,
      },
    });
    render(<NewsletterSendClient />);
    fillForm();

    fireEvent.click(screen.getByRole('button', { name: 'Изпрати до абонати' }));

    await waitFor(() => expect(getNewsletterSendStatus).toHaveBeenCalled());
    expect(screen.getByRole('status')).toHaveTextContent('Няма активни абонати за избраните езици');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('validates at least one selected language before sending', () => {
    render(<NewsletterSendClient />);
    fillForm();

    fireEvent.click(screen.getByLabelText('Български'));
    fireEvent.click(screen.getByLabelText('English'));
    fireEvent.click(screen.getByRole('button', { name: 'Изпрати тест' }));

    expect(screen.getByRole('status')).toHaveTextContent('Моля, изберете поне един език');
    expect(sendNewsletterTest).not.toHaveBeenCalled();
  });

  it('sends only the selected language group after confirmation', async () => {
    render(<NewsletterSendClient />);
    fillForm();

    fireEvent.click(screen.getByLabelText('Български'));
    fireEvent.click(screen.getByRole('button', { name: 'Изпрати до абонати' }));

    await waitFor(() => expect(getNewsletterSendStatus).toHaveBeenCalled());
    expect(screen.getByRole('dialog')).toHaveTextContent('1 активни');
    expect(screen.getByRole('dialog')).toHaveTextContent('English: 1');
    expect(screen.getByRole('dialog')).not.toHaveTextContent('Български:');

    fireEvent.click(screen.getByRole('button', { name: 'Потвърждавам' }));

    await waitFor(() =>
      expect(sendNewsletterToSubscribers).toHaveBeenCalledWith(
        expect.objectContaining({
          locales: ['en'],
        })
      )
    );
  });

  it('shows partial failure warnings without exposing subscriber emails', async () => {
    sendNewsletterToSubscribers.mockResolvedValueOnce({
      message: 'Newsletter send finished with failures.',
      sent: 2,
      failed: 1,
      activeSubscribers: 3,
    });
    render(<NewsletterSendClient />);
    fillForm();

    fireEvent.click(screen.getByRole('button', { name: 'Изпрати до абонати' }));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Потвърждавам' }));

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Изпращането завърши с 1 неуспешни имейла')
    );
    expect(screen.getByRole('status')).not.toHaveTextContent('@');
  });

  it('loads product prefill from query params and keeps source id in send payload', async () => {
    setMockNavigation({
      searchParams: new URLSearchParams('source=product&id=product-1'),
    });
    render(<NewsletterSendClient />);

    await waitFor(() => expect(getProductNewsletterPrefill).toHaveBeenCalledWith('product-1'));
    expect(screen.getByLabelText('Тема')).toHaveValue('Product newsletter');
    expect(screen.getByLabelText('Съдържание')).toHaveValue('');
    expect(screen.getByRole('complementary', { name: 'Резюме' })).toHaveTextContent('/products/product-1');

    fireEvent.change(screen.getByLabelText('Съдържание'), {
      target: { value: 'Edited product content' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Изпрати тест' }));

    await waitFor(() => expect(sendNewsletterTest).toHaveBeenCalled());
    expect(sendNewsletterTest).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Product newsletter',
        sourceType: 'product',
        sourceId: 'product-1',
      })
    );
  });

  it('loads blog prefill from query params and keeps source id in send payload', async () => {
    setMockNavigation({
      searchParams: new URLSearchParams('source=blog&id=article-1'),
    });
    render(<NewsletterSendClient />);

    await waitFor(() => expect(getBlogNewsletterPrefill).toHaveBeenCalledWith('article-1'));
    expect(screen.getAllByRole('textbox')[0]).toHaveValue('Blog newsletter');
    expect(screen.getByText('/blog/article-1')).toBeInTheDocument();

    fireEvent.change(screen.getAllByRole('textbox')[1], {
      target: { value: 'Edited blog content' },
    });
    fireEvent.click(screen.getAllByRole('button')[0]);

    await waitFor(() => expect(sendNewsletterTest).toHaveBeenCalled());
    expect(sendNewsletterTest).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Blog newsletter',
        sourceType: 'blog',
        sourceId: 'article-1',
      })
    );
  });
});
