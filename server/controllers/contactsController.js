// server/controllers/contactsController.js

import express from 'express';
import { handleContactForm } from '../services/contactsServices.js';

const router = express.Router();
const CONTACT_MESSAGE_MAX_LENGTH = 1000;
const CARTOON_CONTACT_MESSAGE_MAX_LENGTH = 1500;
const CARTOONS_SERVICE_VALUE = 'cartoons';

function getReleasedContactService(value) {
  const isCartoonServiceEnabled = process.env.NEXT_PUBLIC_CARTOONS_SERVICE_ENABLED === 'true';

  return isCartoonServiceEnabled && value === CARTOONS_SERVICE_VALUE
    ? CARTOONS_SERVICE_VALUE
    : '';
}

// Хелпър за премахване на HTML тагове
function sanitizeText(input) {
  return String(input).replace(/<\/?[^>]+(>|$)/g, '').trim();
}

// Проверка за валиден email
function isValidEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(String(email).trim());
}

// Много лека проверка за URL (не е перфектна, но е достатъчна за тази нужда)
function isValidUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

router.post('/', async (req, res) => {
  try {
    const {
      name,
      email,
      phone = '',
      message,
      productId = '',
      productTitle = '',
      productUrl = '',
      service = '',
    } = req.body;
    const releasedService = getReleasedContactService(service);
    const isCartoonService = releasedService === CARTOONS_SERVICE_VALUE;
    const messageMaxLength = isCartoonService
      ? CARTOON_CONTACT_MESSAGE_MAX_LENGTH
      : CONTACT_MESSAGE_MAX_LENGTH;

    // Задължителни полета
    if (!name || !email || !message) {
      return res.status(400).json({ message: 'Липсват задължителни полета.' });
    }

    // Валидации за дължини
    if (name.trim().length < 3 || name.trim().length > 20) {
      return res
        .status(400)
        .json({ message: 'Името трябва да е между 3 и 20 символа.' });
    }

    if (phone && phone.trim().length > 20) {
      return res
        .status(400)
        .json({ message: 'Телефонът е прекалено дълъг (макс. 20 символа).' });
    }

    if (message.trim().length > messageMaxLength) {
      return res
        .status(400)
        .json({ message: `Съобщението е прекалено дълго (макс. ${messageMaxLength} символа).` });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Невалиден email формат.' });
    }

    // Забранени символи (HTML/code injection)
    const forbiddenPattern = /<[^>]*>/;

    const allFields = [name, email, phone, message, productId, productTitle, productUrl, service];

    if (allFields.some((val) => forbiddenPattern.test(String(val).trim()))) {
      return res.status(400).json({ message: 'Забранени символи в полетата!' });
    }

    // ✅ ако има productUrl — валидираме, за да не пращаме боклуци в мейла
    if (!isCartoonService && productUrl && !isValidUrl(String(productUrl).trim())) {
      return res.status(400).json({ message: 'Невалиден линк към продукт.' });
    }

    const cleanData = {
      name: sanitizeText(name),
      email: sanitizeText(email),
      phone: sanitizeText(phone),
      message: sanitizeText(message),
      productId: sanitizeText(productId),
      productTitle: isCartoonService ? '' : sanitizeText(productTitle),
      productUrl: isCartoonService ? '' : sanitizeText(productUrl),
      service: releasedService,
    };

    await handleContactForm(cleanData);

    return res.status(200).json({ message: 'Съобщението беше изпратено успешно.' });
  } catch (err) {
    console.error('Грешка при контактна форма:', err);
    return res.status(500).json({ message: 'Грешка при изпращане на съобщението.' });
  }
});

export default router;
