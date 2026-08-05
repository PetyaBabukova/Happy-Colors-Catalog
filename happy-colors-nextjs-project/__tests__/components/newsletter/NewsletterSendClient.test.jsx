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

function fillActiveVariant({ subject, body, ctaLabel }) {
  fireEvent.change(screen.getByLabelText(/Тема/), {
    target: { value: subject },
  });
  fireEvent.change(screen.getByLabelText(/Бутон/), {
    target: { value: ctaLabel },
  });
  fireEvent.change(screen.getByLabelText('Съдържание'), {
    target: { value: body },
  });
}

function fillBothVariants() {
  fillActiveVariant({
    subject: 'Новини от Happy Colors',
    body: 'Ръчно изработени подаръци',
    ctaLabel: 'Виж повече',
  });
  fireEvent.click(screen.getByRole('tab', { name: 'EN' }));
  fillActiveVariant({
    subject: 'Happy Colors news',
    body: 'Handmade gifts',
    ctaLabel: 'View more',
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
      contentByLocale: {
        bg: {
          subject: 'Product newsletter',
          contentHtml: '<p>Product content</p>',
          contentText: 'Product content',
          ctaLabel: 'Виж повече',
        },
        en: {
          subject: 'Product newsletter EN',
          contentHtml: '<p>Product content EN</p>',
          contentText: 'Product content EN',
          ctaLabel: 'View more',
        },
      },
    });
    getBlogNewsletterPrefill.mockResolvedValue({
      sourceType: 'blog',
      sourceId: 'article-1',
      subject: 'Blog newsletter',
      contentHtml: '<p>Blog content</p>',
      contentText: 'Blog content',
      imageUrl: 'https://cdn.example.com/blog.webp',
      ctaUrl: '/blog/article-1',
      ctaLabel: 'Виж повече',
      contentByLocale: {
        bg: {
          subject: 'Blog newsletter',
          contentHtml: '<p>Blog content</p>',
          contentText: 'Blog content',
          ctaLabel: 'Виж повече',
        },
      },
    });
    sendNewsletterTest.mockResolvedValue({ message: 'Test email sent.', recipients: 4 });
    sendNewsletterToSubscribers.mockResolvedValue({
      message: 'Newsletter send finished.',
      sent: 3,
      failed: 0,
      activeSubscribers: 3,
    });
  });

  it('validates required fields for the first selected language before sending', () => {
    render(<NewsletterSendClient />);

    fireEvent.click(screen.getByRole('button', { name: 'Изпрати тест' }));

    expect(screen.getByRole('status')).toHaveTextContent('Моля, въведете тема на имейла за Български.');
    expect(sendNewsletterTest).not.toHaveBeenCalled();
  });

  it('builds a test-send payload with separate BG and EN content', async () => {
    render(<NewsletterSendClient />);
    fillBothVariants();

    fireEvent.click(screen.getByRole('button', { name: 'Изпрати тест' }));

    await waitFor(() => expect(sendNewsletterTest).toHaveBeenCalled());
    expect(sendNewsletterTest).toHaveBeenCalledWith({
      contentByLocale: {
        bg: {
          subject: 'Новини от Happy Colors',
          contentHtml: '<p>Ръчно изработени подаръци</p>',
          contentJson: { type: 'doc', content: [{ type: 'paragraph' }] },
          contentText: 'Ръчно изработени подаръци',
          ctaLabel: 'Виж повече',
        },
        en: {
          subject: 'Happy Colors news',
          contentHtml: '<p>Handmade gifts</p>',
          contentJson: { type: 'doc', content: [{ type: 'paragraph' }] },
          contentText: 'Handmade gifts',
          ctaLabel: 'View more',
        },
      },
      sourceType: 'custom',
      locales: ['bg', 'en'],
    });
    expect(screen.getByRole('status')).toHaveTextContent('Test email sent.');
  });

  it('opens a confirmation modal with active subscriber count before broadcast', async () => {
    render(<NewsletterSendClient />);
    fillBothVariants();

    fireEvent.click(screen.getByRole('button', { name: 'Изпрати до абонати' }));

    await waitFor(() => expect(getNewsletterSendStatus).toHaveBeenCalled());
    expect(screen.getByRole('dialog')).toHaveTextContent('3 активни');
    expect(screen.getByRole('dialog')).toHaveTextContent('Български: 2');
    expect(screen.getByRole('dialog')).toHaveTextContent('English: 1');
    expect(sendNewsletterToSubscribers).not.toHaveBeenCalled();
  });

  it('cancels and confirms broadcast from the modal', async () => {
    render(<NewsletterSendClient />);
    fillBothVariants();

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
        contentByLocale: expect.objectContaining({
          bg: expect.objectContaining({ subject: 'Новини от Happy Colors' }),
          en: expect.objectContaining({ subject: 'Happy Colors news' }),
        }),
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
    fillBothVariants();

    fireEvent.click(screen.getByRole('button', { name: 'Изпрати до абонати' }));

    await waitFor(() => expect(getNewsletterSendStatus).toHaveBeenCalled());
    expect(screen.getByRole('status')).toHaveTextContent('Няма активни абонати за избраните езици');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('validates at least one selected language before sending', () => {
    render(<NewsletterSendClient />);
    fillBothVariants();

    fireEvent.click(screen.getByLabelText('Български'));
    fireEvent.click(screen.getByLabelText('English'));
    fireEvent.click(screen.getByRole('button', { name: 'Изпрати тест' }));

    expect(screen.getByRole('status')).toHaveTextContent('Моля, изберете поне един език');
    expect(sendNewsletterTest).not.toHaveBeenCalled();
  });

  it('sends only the selected language group after confirmation', async () => {
    render(<NewsletterSendClient />);
    fillBothVariants();

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
          contentByLocale: {
            en: expect.objectContaining({ subject: 'Happy Colors news' }),
          },
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
    fillBothVariants();

    fireEvent.click(screen.getByRole('button', { name: 'Изпрати до абонати' }));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Потвърждавам' }));

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Изпращането завърши с 1 неуспешни имейла')
    );
    expect(screen.getByRole('status')).not.toHaveTextContent('@');
  });

  it('loads product prefill from query params into localized content and keeps source id in send payload', async () => {
    setMockNavigation({
      searchParams: new URLSearchParams('source=product&id=product-1'),
    });
    render(<NewsletterSendClient />);

    await waitFor(() => expect(getProductNewsletterPrefill).toHaveBeenCalledWith('product-1'));
    expect(screen.getByLabelText(/Тема/)).toHaveValue('Product newsletter');
    expect(screen.getByRole('complementary', { name: 'Резюме' })).toHaveTextContent('/products/product-1');

    fireEvent.click(screen.getByRole('tab', { name: 'EN' }));
    expect(screen.getByLabelText(/Тема/)).toHaveValue('Product newsletter EN');
    fireEvent.click(screen.getByLabelText('English'));
    fireEvent.change(screen.getByLabelText('Съдържание'), {
      target: { value: 'Edited product content' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Изпрати тест' }));

    await waitFor(() => expect(sendNewsletterTest).toHaveBeenCalled());
    expect(sendNewsletterTest).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: 'product',
        sourceId: 'product-1',
        locales: ['bg'],
        contentByLocale: {
          bg: expect.objectContaining({ subject: 'Product newsletter' }),
        },
      })
    );
  });

  it('loads blog prefill from query params and keeps source id in send payload', async () => {
    setMockNavigation({
      searchParams: new URLSearchParams('source=blog&id=article-1'),
    });
    render(<NewsletterSendClient />);

    await waitFor(() => expect(getBlogNewsletterPrefill).toHaveBeenCalledWith('article-1'));
    expect(screen.getByLabelText(/Тема/)).toHaveValue('Blog newsletter');
    expect(screen.getByText('/blog/article-1')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('English'));
    fireEvent.click(screen.getByRole('tab', { name: 'EN' }));
    fillActiveVariant({
      subject: 'Blog newsletter EN',
      body: 'Edited blog content',
      ctaLabel: 'View more',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Изпрати тест' }));

    await waitFor(() => expect(sendNewsletterTest).toHaveBeenCalled());
    expect(sendNewsletterTest).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: 'blog',
        sourceId: 'article-1',
        locales: ['bg'],
      })
    );
  });
});
