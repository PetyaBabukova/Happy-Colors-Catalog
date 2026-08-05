import { sendEmail } from '../helpers/sendEmail.js';

export async function handleContactForm({
  name,
  email,
  phone,
  message,
  productId,
  productTitle,
  productUrl,
  service,
}) {
  const baseClientUrl = process.env.CLIENT_URL || '';
  const isCartoonService = service === 'cartoons';
  const safeProductTitle = isCartoonService ? '' : productTitle;
  const safeProductUrl = isCartoonService ? '' : productUrl;
  const fallbackUrl =
    !isCartoonService && productId && baseClientUrl ? `${baseClientUrl}/products/${productId}` : null;

  const finalProductUrl = safeProductUrl || fallbackUrl;
  const hasProduct = safeProductTitle || productId || finalProductUrl;

  const subject = isCartoonService
    ? 'Запитване за шарж от контактната форма на Happy Colors'
    : safeProductTitle
      ? `Запитване за: ${safeProductTitle}`
    : finalProductUrl
      ? `Запитване относно продукт: ${finalProductUrl}`
      : 'Ново съобщение от контактната форма на Happy Colors';

  const productBlock = hasProduct
    ? [
        isCartoonService && 'Услуга: Шаржове',
        safeProductTitle && `Продукт: ${safeProductTitle}`,
        productId && `Product ID: ${productId}`,
        finalProductUrl && `Линк: ${finalProductUrl}`,
      ]
        .filter(Boolean)
        .join('\n')
    : isCartoonService
      ? 'Услуга: Шаржове'
      : '';

  const text = [
    `Име: ${name}`,
    `Имейл: ${email}`,
    `Телефон: ${phone || '-'}`,
    '',
    productBlock,
    productBlock ? '' : null,
    'Съобщение:',
    message,
  ]
    .filter((line) => line !== null)
    .join('\n');

  await sendEmail({ subject, text });
}
