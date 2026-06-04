import Order from '../models/Order.js';
import Product from '../models/Product.js';
import { buildPublicProductFilter } from '../utils/productPublication.js';
import { sendEmail } from '../helpers/sendEmail.js';

class OrderError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

// ----------------------
// Helpers
// ----------------------

function sanitizeText(input) {
  return String(input ?? '').replace(/<\/?[^>]+(>|$)/g, '').trim();
}

function isValidEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(String(email ?? '').trim());
}

function isValidPaymentMethod(method) {
  return ['card', 'cod'].includes(method);
}

function getDeliveryProviderLabel(shippingMethod) {
  switch (shippingMethod) {
    case 'econt':
      return 'Еконт';
    case 'speedy':
      return 'Спиди';
    case 'boxnow':
      return 'Box Now';
    default:
      return '-';
  }
}

function getDeliveryDetailsText(cleanShipping, cleanCustomer) {
  const providerLabel = getDeliveryProviderLabel(cleanShipping.shippingMethod);

  if (cleanShipping.shippingMethod === 'econt') {
    return `Доставчик: ${providerLabel}\nОфис/автомат: ${cleanShipping.econtOffice || '-'}`;
  }

  if (cleanShipping.shippingMethod === 'speedy') {
    return `Доставчик: ${providerLabel}\nОфис/автомат: ${cleanShipping.speedyOffice || '-'}`;
  }

  if (cleanShipping.shippingMethod === 'boxnow') {
    return `Доставчик: ${providerLabel}\nАдрес: ${cleanCustomer.address || '-'}`;
  }

  return `Доставчик: ${providerLabel}`;
}

function buildCustomerProductsText(items, clientUrl) {
  return items
    .map((item) => {
      const productId = item.productId ? String(item.productId) : '';
      const productLink = productId ? `${clientUrl}/products/${productId}` : clientUrl;
      return `- ${item.title}\n${productLink}`;
    })
    .join('\n\n');
}

function normalizeCartItemProductId(item) {
  return String(item?._id || item?.productId || '').trim();
}

function normalizeCartItemQuantity(item) {
  return Number(item?.quantity || 0);
}

function logEmailFailure(context, error) {
  console.error(`Email failure [${context}]`, {
    code: error?.code || 'UNKNOWN',
    message: error?.message || 'Unknown email error',
  });
}

async function buildOrderItemsFromDatabase(cartItems) {
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    throw new OrderError('Количката е празна или невалидна.', 400);
  }

  const normalizedItems = cartItems.map((item) => ({
    productId: normalizeCartItemProductId(item),
    quantity: normalizeCartItemQuantity(item),
  }));

  if (normalizedItems.some((item) => !item.productId)) {
    throw new OrderError('Липсва продукт в количката.', 400);
  }

  if (
    normalizedItems.some(
      (item) => !Number.isInteger(item.quantity) || item.quantity <= 0
    )
  ) {
    throw new OrderError('Невалидно количество на продукт.', 400);
  }

  const uniqueProductIds = [...new Set(normalizedItems.map((item) => item.productId))];

  const products = await Product.find({
    ...buildPublicProductFilter(),
    _id: { $in: uniqueProductIds },
  }).lean();

  if (products.length !== uniqueProductIds.length) {
    throw new OrderError('Един или повече продукти не съществуват.', 404);
  }

  const productMap = new Map(
    products.map((product) => [String(product._id), product])
  );

  const mappedItems = normalizedItems.map((item) => {
    const product = productMap.get(item.productId);

    if (!product) {
      throw new OrderError('Един или повече продукти не съществуват.', 404);
    }

    const unitPrice = Number(product.price);

    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      throw new OrderError(`Невалидна цена за продукт "${product.title}".`, 400);
    }

    return {
      productId: String(product._id),
      title: String(product.title || ''),
      quantity: item.quantity,
      unitPrice,
    };
  });

  const totalPrice = mappedItems.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );

  return {
    mappedItems,
    totalPrice,
  };
}

// ----------------------
// Main service
// ----------------------

export async function handleOrder(rawData) {
  const {
    name,
    email,
    phone = '',
    city,
    address = '',
    note = '',
    paymentMethod,
    cartItems = [],
    shippingMethod = '',
    econtOffice = '',
    speedyOffice = '',
    boxNow = false,
  } = rawData || {};

  const safeName = String(name ?? '').trim();
  const safeEmail = String(email ?? '').trim();
  const safePhone = String(phone ?? '').trim();
  const safeCity = String(city ?? '').trim();
  const safeAddress = String(address ?? '').trim();
  const safeNote = String(note ?? '').trim();
  const safeShippingMethod = String(shippingMethod ?? '').trim();
  const safeEcontOffice = String(econtOffice ?? '').trim();
  const safeSpeedyOffice = String(speedyOffice ?? '').trim();

  // ----------------------
  // 1) Basic validations
  // ----------------------

  if (!safeName || !safeEmail || !safePhone || !safeCity || !paymentMethod) {
    throw new OrderError('Липсват задължителни полета.', 400);
  }

  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    throw new OrderError('Количката е празна или невалидна.', 400);
  }

  if (!isValidEmail(safeEmail)) {
    throw new OrderError('Невалиден email формат.', 400);
  }

  if (!isValidPaymentMethod(paymentMethod)) {
    throw new OrderError('Невалиден начин на плащане.', 400);
  }

  if (paymentMethod === 'card') {
    throw new OrderError(
      'Плащането с карта се обработва през Stripe. Моля използвайте card checkout flow.',
      400
    );
  }

  if (!safeShippingMethod) {
    throw new OrderError('Липсва информация за начина на доставка.', 400);
  }

  if (safeShippingMethod === 'econt' && !safeEcontOffice) {
    throw new OrderError('Моля, изберете офис или автомат на Еконт.', 400);
  }

  if (safeShippingMethod === 'speedy' && !safeSpeedyOffice) {
    throw new OrderError('Моля, изберете офис или автомат на Спиди.', 400);
  }

  if (safeShippingMethod === 'boxnow' && !safeAddress) {
    throw new OrderError('Моля, въведете адрес за доставка.', 400);
  }

  // ----------------------
  // 2) Length & security checks
  // ----------------------

  if (safeName.length < 3 || safeName.length > 50) {
    throw new OrderError('Името трябва да е между 3 и 50 символа.', 400);
  }

  if (safePhone.length > 20) {
    throw new OrderError('Телефонът е прекалено дълъг.', 400);
  }

  if (safeCity.length < 2 || safeCity.length > 50) {
    throw new OrderError('Градът трябва да е между 2 и 50 символа.', 400);
  }

  if (safeShippingMethod === 'boxnow') {
    if (safeAddress.length < 5 || safeAddress.length > 200) {
      throw new OrderError('Адресът трябва да е между 5 и 200 символа.', 400);
    }
  }

  if (safeNote && safeNote.length > 500) {
    throw new OrderError('Бележката е прекалено дълга.', 400);
  }

  if (shippingMethod === 'boxnow' && paymentMethod === 'cod') {
    throw new Error('За Box Now е позволено само плащане с банкова карта.');
  }

  const forbiddenPattern = /<[^>]*>/g;
  const allFields = [
    safeName,
    safeEmail,
    safePhone,
    safeCity,
    safeAddress,
    safeNote,
    safeShippingMethod,
    safeEcontOffice,
    safeSpeedyOffice,
  ];

  if (allFields.some((v) => forbiddenPattern.test(String(v)))) {
    throw new OrderError('Забранени символи в полетата.', 400);
  }

  // ----------------------
  // 3) Sanitization
  // ----------------------

  const cleanCustomer = {
    name: sanitizeText(safeName),
    email: sanitizeText(safeEmail),
    phone: sanitizeText(safePhone),
    city: sanitizeText(safeCity),
    address: safeShippingMethod === 'boxnow' ? sanitizeText(safeAddress) : '',
    note: sanitizeText(safeNote),
  };

  const cleanShipping = {
    shippingMethod: sanitizeText(safeShippingMethod),
    econtOffice: safeShippingMethod === 'econt' ? sanitizeText(safeEcontOffice) : '',
    speedyOffice: safeShippingMethod === 'speedy' ? sanitizeText(safeSpeedyOffice) : '',
    boxNow: Boolean(boxNow),
  };

  // ----------------------
  // 4) Build items from DB
  // ----------------------

  const {
    mappedItems,
    totalPrice: safeTotalPrice,
  } = await buildOrderItemsFromDatabase(cartItems);

  // ----------------------
  // 5) Create Order (COD only)
  // ----------------------

  const order = await Order.create({
    customer: cleanCustomer,
    shipping: cleanShipping,
    items: mappedItems,
    totalPrice: safeTotalPrice,
    paymentMethod: 'cod',
    status: 'new',
  });

  // ----------------------
  // 6) Emails (admin + customer)
  // ----------------------

  const adminSubject = `Поръчка от ${cleanCustomer.name}`;

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';

  const itemsText = mappedItems
    .map((item) => {
      const productId = item.productId ? String(item.productId) : '-';
      const productLink = `${clientUrl}/products/${productId}`;
      return `- ${item.title}\n  ${productLink}\n  ID: ${productId} | количество: ${item.quantity} | цена: ${Number(item.unitPrice).toFixed(2)} €`;
    })
    .join('\n\n');

  const customerProductsText = buildCustomerProductsText(mappedItems, clientUrl);
  const customerNote = cleanCustomer.note ? cleanCustomer.note : 'няма';
  const deliveryDetailsText = getDeliveryDetailsText(cleanShipping, cleanCustomer);

  const adminText = `
Нова поръчка от Happy Colors

Order ID: ${order._id}

Име: ${cleanCustomer.name}
Имейл: ${cleanCustomer.email}
Телефон: ${cleanCustomer.phone}
Град: ${cleanCustomer.city}
Адрес: ${cleanCustomer.address || '-'}

Бележка от клиента: ${customerNote}

Начин на плащане: Наложен платеж

${deliveryDetailsText}

Поръчани продукти:
${itemsText}

Обща сума: ${safeTotalPrice.toFixed(2)} €
`.trim();

  try {
    await sendEmail({ subject: adminSubject, text: adminText });
  } catch (e) {
    logEmailFailure('orders.admin', e);
  }

  const customerSubject = 'Поръчката ви е приета (Happy Colors)';
  const customerText = `
Здравейте, ${cleanCustomer.name}!

Поръчката ви е приета. Можете да видите поръчания продукт тук:

${customerProductsText}

Благодарим Ви! Ще се свържем с Вас при първа възможност.

Поздрави,
Happy Colors
`.trim();

  try {
    await sendEmail({
      to: cleanCustomer.email,
      subject: customerSubject,
      text: customerText,
    });
  } catch (e) {
    logEmailFailure('orders.customer', e);
  }

  return {
    message: 'Поръчката беше изпратена успешно.',
    orderId: order._id,
  };
}
