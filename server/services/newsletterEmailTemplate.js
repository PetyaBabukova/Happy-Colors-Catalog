const DEFAULT_LOCALE = 'bg';
const SUPPORTED_LOCALES = new Set(['bg', 'en']);
const DEFAULT_CTA_LABELS = {
  bg: 'Виж повече',
  en: 'View more',
};
const TEST_UNSUBSCRIBE_NOTES = {
  bg: 'Това е тестов имейл. Реалните имейли до абонати съдържат индивидуални линкове за отписване и езикови настройки.',
  en: 'This is a test email. Real subscriber emails include individual unsubscribe and language-preference links.',
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeLocale(locale) {
  const normalizedLocale = normalizeText(locale || DEFAULT_LOCALE).toLowerCase();

  return SUPPORTED_LOCALES.has(normalizedLocale) ? normalizedLocale : DEFAULT_LOCALE;
}

function buildHeaders({ unsubscribeUrl, listUnsubscribeUrl, isTest }) {
  if (isTest || !unsubscribeUrl) {
    return {};
  }

  const headerUnsubscribeUrl = normalizeText(listUnsubscribeUrl) || unsubscribeUrl;

  return {
    'List-Unsubscribe': `<${headerUnsubscribeUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

function buildFooterHtml({ unsubscribeUrl, preferencesUrl, isTest, locale }) {
  if (isTest) {
    return `<p style="margin:0;color:#666;font-size:13px;line-height:1.5;">${escapeHtml(TEST_UNSUBSCRIBE_NOTES[locale])}</p>`;
  }

  if (locale === 'en') {
    return [
      '<p style="margin:0;color:#666;font-size:13px;line-height:1.5;">',
      'You can unsubscribe at any time using ',
      `<a href="${escapeHtml(unsubscribeUrl)}" style="color:#2f6f4e;">this link</a>.`,
      '<br>',
      'You can change your newsletter language ',
      `<a href="${escapeHtml(preferencesUrl)}" style="color:#2f6f4e;">here</a>.`,
      '</p>',
    ].join('');
  }

  return [
    '<p style="margin:0;color:#666;font-size:13px;line-height:1.5;">',
    'Можете да се отпишете по всяко време от ',
    `<a href="${escapeHtml(unsubscribeUrl)}" style="color:#2f6f4e;">този линк</a>.`,
    '<br>',
    'Можете да смените езика на бюлетина ',
    `<a href="${escapeHtml(preferencesUrl)}" style="color:#2f6f4e;">тук</a>.`,
    '</p>',
  ].join('');
}

function buildFooterText({ unsubscribeUrl, preferencesUrl, isTest, locale }) {
  if (isTest) {
    return TEST_UNSUBSCRIBE_NOTES[locale];
  }

  if (locale === 'en') {
    return [
      `You can unsubscribe at any time using this link: ${unsubscribeUrl}`,
      `You can change your newsletter language here: ${preferencesUrl}`,
    ].join('\n');
  }

  return [
    `Можете да се отпишете по всяко време от този линк: ${unsubscribeUrl}`,
    `Можете да смените езика на бюлетина тук: ${preferencesUrl}`,
  ].join('\n');
}

export function buildNewsletterEmailTemplate({
  subject,
  title,
  contentHtml,
  contentText,
  imageUrl,
  ctaUrl,
  ctaLabel,
  unsubscribeUrl,
  listUnsubscribeUrl,
  preferencesUrl,
  locale = DEFAULT_LOCALE,
  isTest = false,
}) {
  const safeLocale = normalizeLocale(locale);
  const safeSubject = normalizeText(subject || title);
  const safeTitle = normalizeText(title || subject);
  const safeContentText = normalizeText(contentText);
  const safeCtaLabel = normalizeText(ctaLabel) || DEFAULT_CTA_LABELS[safeLocale];
  const safeContentHtml = String(contentHtml || '').trim();
  const safeUnsubscribeUrl = normalizeText(unsubscribeUrl);
  const safePreferencesUrl = normalizeText(preferencesUrl);

  if (!isTest && !safeUnsubscribeUrl) {
    throw new Error('Newsletter unsubscribe URL is required for subscriber emails.');
  }

  if (!isTest && !safePreferencesUrl) {
    throw new Error('Newsletter preferences URL is required for subscriber emails.');
  }

  const imageBlock = imageUrl
    ? [
        '<tr>',
        '<td style="padding:0 0 24px;">',
        `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(safeTitle || 'Happy Colors')}" style="display:block;width:100%;max-width:640px;height:auto;border:0;" />`,
        '</td>',
        '</tr>',
      ].join('')
    : '';

  const ctaBlock = ctaUrl
    ? [
        '<tr>',
        '<td style="padding:24px 28px;">',
        `<a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#2f6f4e;color:#fff;text-decoration:none;padding:12px 18px;border-radius:4px;font-weight:700;">${escapeHtml(safeCtaLabel)}</a>`,
        '</td>',
        '</tr>',
      ].join('')
    : '';

  const html = [
    '<!doctype html>',
    `<html lang="${safeLocale}">`,
    '<head>',
    '<meta charset="UTF-8">',
    `<title>${escapeHtml(safeSubject)}</title>`,
    '</head>',
    '<body style="margin:0;padding:0;background:#f7f4ef;font-family:Arial,sans-serif;color:#222;">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#f7f4ef;">',
    '<tr>',
    '<td align="center" style="padding:24px 12px;">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;max-width:640px;background:#ffffff;">',
    `<tr><td style="padding:28px 28px 16px;"><h1 style="margin:0;font-size:24px;line-height:1.25;color:#2f6f4e;">${escapeHtml(safeTitle)}</h1></td></tr>`,
    imageBlock,
    `<tr><td style="padding:0 28px 8px;font-size:16px;line-height:1.6;">${safeContentHtml}</td></tr>`,
    ctaBlock,
    `<tr><td style="padding:20px 28px 28px;border-top:1px solid #eee;">${buildFooterHtml({
      unsubscribeUrl: safeUnsubscribeUrl,
      preferencesUrl: safePreferencesUrl,
      isTest,
      locale: safeLocale,
    })}</td></tr>`,
    '</table>',
    '</td>',
    '</tr>',
    '</table>',
    '</body>',
    '</html>',
  ].join('');

  const textParts = [
    safeTitle,
    '',
    safeContentText,
    '',
    ctaUrl ? `${safeCtaLabel}: ${ctaUrl}` : '',
    '',
    buildFooterText({
      unsubscribeUrl: safeUnsubscribeUrl,
      preferencesUrl: safePreferencesUrl,
      isTest,
      locale: safeLocale,
    }),
  ].filter((part) => part !== '');

  return {
    subject: safeSubject,
    html,
    text: textParts.join('\n'),
    headers: buildHeaders({ unsubscribeUrl: safeUnsubscribeUrl, listUnsubscribeUrl, isTest }),
  };
}
