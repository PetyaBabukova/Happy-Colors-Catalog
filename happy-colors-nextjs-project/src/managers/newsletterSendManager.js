import baseURL from '@/config';
import { createResponseError, readResponseJsonSafely } from '@/utils/errorHandler';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
};
const SEND_FIELDS = ['subject', 'contentHtml', 'contentJson', 'contentText', 'sourceType', 'sourceId'];

function pickSendFields(values = {}) {
  return SEND_FIELDS.reduce((payload, field) => {
    if (Object.prototype.hasOwnProperty.call(values, field)) {
      payload[field] = values[field];
    }

    return payload;
  }, {});
}

async function readOrThrow(res, fallbackMessage) {
  const data = await readResponseJsonSafely(res);

  if (!res.ok) {
    throw createResponseError(data?.message || fallbackMessage, data);
  }

  return data;
}

export async function getNewsletterSendStatus() {
  const res = await fetch(`${baseURL}/newsletter/send/status`, {
    credentials: 'include',
    cache: 'no-store',
  });

  return readOrThrow(res, 'Не успяхме да заредим броя активни абонати.');
}

export async function sendNewsletterTest(values) {
  const res = await fetch(`${baseURL}/newsletter/send/test`, {
    method: 'POST',
    headers: JSON_HEADERS,
    credentials: 'include',
    body: JSON.stringify(pickSendFields(values)),
  });

  return readOrThrow(res, 'Не успяхме да изпратим тестовия имейл.');
}

export async function sendNewsletterToSubscribers(values) {
  const res = await fetch(`${baseURL}/newsletter/send`, {
    method: 'POST',
    headers: JSON_HEADERS,
    credentials: 'include',
    body: JSON.stringify(pickSendFields(values)),
  });

  return readOrThrow(res, 'Не успяхме да изпратим имейла до абонатите.');
}

export async function getProductNewsletterPrefill(productId) {
  const res = await fetch(`${baseURL}/newsletter/send/prefill/product/${productId}`, {
    credentials: 'include',
    cache: 'no-store',
  });

  return readOrThrow(res, 'Не успяхме да заредим данните за продукта.');
}

export async function getBlogNewsletterPrefill(articleId) {
  const res = await fetch(`${baseURL}/newsletter/send/prefill/blog/${articleId}`, {
    credentials: 'include',
    cache: 'no-store',
  });

  return readOrThrow(res, 'Не успяхме да заредим данните за статията.');
}
