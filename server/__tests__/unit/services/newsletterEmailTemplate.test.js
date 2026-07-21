import { describe, expect, it } from 'vitest';
import { buildNewsletterEmailTemplate } from '../../../services/newsletterEmailTemplate.js';

const baseInput = {
  subject: 'Новини от Happy Colors',
  title: 'Нова колекция',
  contentHtml: '<p>Ръчно изработени подаръци.</p>',
  contentText: 'Ръчно изработени подаръци.',
  imageUrl: 'https://happycolors.eu/og/happy-colors-og.png',
  ctaUrl: 'https://happycolors.eu/products',
  unsubscribeUrl: 'https://happycolors.eu/bg/newsletter/unsubscribe?token=token-1',
  listUnsubscribeUrl: 'https://happycolors.eu/api/newsletter/unsubscribe/one-click?token=token-1',
  preferencesUrl: 'https://happycolors.eu/bg/newsletter/preferences#token=preferences-1',
};

describe('newsletterEmailTemplate', () => {
  it('renders subscriber email HTML, text, CTA, image, and unsubscribe headers', () => {
    const result = buildNewsletterEmailTemplate(baseInput);

    expect(result.subject).toBe('Новини от Happy Colors');
    expect(result.html).toContain('<meta charset="UTF-8">');
    expect(result.html).toContain('Нова колекция');
    expect(result.html).toContain('<p>Ръчно изработени подаръци.</p>');
    expect(result.html).toContain('https://happycolors.eu/og/happy-colors-og.png');
    expect(result.html).toContain('https://happycolors.eu/products');
    expect(result.html).toContain('padding:24px 28px;');
    expect(result.html).toContain('<html lang="bg">');
    expect(result.html).toContain('https://happycolors.eu/bg/newsletter/unsubscribe?token=token-1');
    expect(result.html).toContain('https://happycolors.eu/bg/newsletter/preferences#token=preferences-1');
    expect(result.text).toContain('Ръчно изработени подаръци.');
    expect(result.text).toContain('Виж повече: https://happycolors.eu/products');
    expect(result.text).toContain(
      'Можете да смените езика на бюлетина тук: https://happycolors.eu/bg/newsletter/preferences#token=preferences-1'
    );
    expect(result.headers).toEqual({
      'List-Unsubscribe': '<https://happycolors.eu/api/newsletter/unsubscribe/one-click?token=token-1>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    });
  });

  it('escapes interpolated plain strings while preserving sanitized content HTML', () => {
    const result = buildNewsletterEmailTemplate({
      ...baseInput,
      title: '<script>alert("x")</script>',
      ctaLabel: '<Виж>',
      contentHtml: '<p><strong>Allowed</strong></p>',
    });

    expect(result.html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(result.html).toContain('&lt;Виж&gt;');
    expect(result.html).toContain('<p><strong>Allowed</strong></p>');
    expect(result.html).not.toContain('<script>');
  });

  it('renders test emails without real unsubscribe headers', () => {
    const result = buildNewsletterEmailTemplate({
      ...baseInput,
      unsubscribeUrl: undefined,
      isTest: true,
    });

    expect(result.headers).toEqual({});
    expect(result.html).toContain('Това е тестов имейл.');
    expect(result.text).toContain('Това е тестов имейл.');
  });

  it('renders English subscriber footer, language, and default CTA label', () => {
    const result = buildNewsletterEmailTemplate({
      ...baseInput,
      locale: 'en',
      ctaLabel: '',
      unsubscribeUrl: 'https://happycolors.eu/en/newsletter/unsubscribe?token=token-1',
      preferencesUrl: 'https://happycolors.eu/en/newsletter/preferences#token=preferences-1',
    });

    expect(result.html).toContain('<html lang="en">');
    expect(result.html).toContain('You can unsubscribe at any time');
    expect(result.html).toContain('https://happycolors.eu/en/newsletter/preferences#token=preferences-1');
    expect(result.text).toContain('View more: https://happycolors.eu/products');
    expect(result.text).toContain(
      'You can change your newsletter language here: https://happycolors.eu/en/newsletter/preferences#token=preferences-1'
    );
  });

  it('requires unsubscribe URLs for real subscriber emails', () => {
    expect(() =>
      buildNewsletterEmailTemplate({
        ...baseInput,
        unsubscribeUrl: '',
      })
    ).toThrow('Newsletter unsubscribe URL is required for subscriber emails.');
  });

  it('requires preferences URLs for real subscriber emails', () => {
    expect(() =>
      buildNewsletterEmailTemplate({
        ...baseInput,
        preferencesUrl: '',
      })
    ).toThrow('Newsletter preferences URL is required for subscriber emails.');
  });
});
