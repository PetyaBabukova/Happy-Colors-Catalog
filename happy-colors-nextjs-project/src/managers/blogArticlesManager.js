import baseURL from '@/config';
import { createResponseError, readResponseJsonSafely } from '@/utils/errorHandler';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
};
const EDIT_FIELDS = [
  'title',
  'contentHtml',
  'contentJson',
  'heroImageUrl',
  'thumbnailImageUrl',
  'heroImageAlt',
  'seoTitle',
  'seoDescription',
];
const CREATE_FIELDS = [...EDIT_FIELDS, 'status'];

function pickFields(values = {}, fields) {
  return fields.reduce((payload, field) => {
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

export async function invalidateBlogCaches(articleId) {
  try {
    const res = await fetch('/api/revalidate/blog', {
      method: 'POST',
      headers: JSON_HEADERS,
      credentials: 'include',
      body: JSON.stringify({ articleId }),
    });

    if (!res.ok) {
      const data = await readResponseJsonSafely(res);
      throw createResponseError(data?.message || 'Неуспешно обновяване на blog cache-а.', data);
    }
  } catch (error) {
    console.error('Неуспешно обновяване на blog cache-а:', error);
  }
}

export async function getBlogArticles() {
  const res = await fetch(`${baseURL}/blog-articles`, {
    next: {
      revalidate: 60,
      tags: ['blog-articles'],
    },
  });
  const data = await readOrThrow(res, 'Неуспешно зареждане на блог статиите.');

  if (!Array.isArray(data)) {
    throw new Error('Неочакван отговор при зареждане на блог статиите.');
  }

  return data;
}

export async function getBlogArticleById(articleId) {
  const res = await fetch(`${baseURL}/blog-articles/${articleId}`, {
    next: {
      revalidate: 60,
      tags: ['blog-articles'],
    },
  });

  return readOrThrow(res, 'Неуспешно зареждане на блог статията.');
}

export async function getAdminBlogArticles() {
  const res = await fetch(`${baseURL}/blog-articles/admin`, {
    credentials: 'include',
    cache: 'no-store',
  });
  const data = await readOrThrow(res, 'Неуспешно зареждане на блог статиите.');

  if (!Array.isArray(data)) {
    throw new Error('Неочакван отговор при зареждане на блог статиите.');
  }

  return data;
}

export async function getAdminBlogArticleById(articleId) {
  const res = await fetch(`${baseURL}/blog-articles/admin/${articleId}`, {
    credentials: 'include',
    cache: 'no-store',
  });

  return readOrThrow(res, 'Неуспешно зареждане на блог статията.');
}

export async function createBlogArticle(values) {
  const res = await fetch(`${baseURL}/blog-articles`, {
    method: 'POST',
    headers: JSON_HEADERS,
    credentials: 'include',
    body: JSON.stringify(pickFields(values, CREATE_FIELDS)),
  });
  const article = await readOrThrow(res, 'Неуспешно създаване на блог статия.');

  await invalidateBlogCaches(article?._id);

  return article;
}

export async function editBlogArticle(articleId, values) {
  const res = await fetch(`${baseURL}/blog-articles/${articleId}`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    credentials: 'include',
    body: JSON.stringify(pickFields(values, EDIT_FIELDS)),
  });
  const article = await readOrThrow(res, 'Неуспешно редактиране на блог статия.');

  await invalidateBlogCaches(articleId);

  return article;
}

export async function updateBlogArticleStatus(articleId, status) {
  const res = await fetch(`${baseURL}/blog-articles/${articleId}/status`, {
    method: 'PATCH',
    headers: JSON_HEADERS,
    credentials: 'include',
    body: JSON.stringify({ status }),
  });
  const article = await readOrThrow(res, 'Неуспешна промяна на статуса на блог статия.');

  await invalidateBlogCaches(articleId);

  return article;
}

export async function archiveBlogArticle(articleId) {
  const res = await fetch(`${baseURL}/blog-articles/${articleId}/archive`, {
    method: 'PATCH',
    credentials: 'include',
  });
  const article = await readOrThrow(res, 'Неуспешно архивиране на блог статия.');

  await invalidateBlogCaches(articleId);

  return article;
}

export async function restoreBlogArticle(articleId) {
  const res = await fetch(`${baseURL}/blog-articles/${articleId}/restore`, {
    method: 'PATCH',
    credentials: 'include',
  });
  const article = await readOrThrow(res, 'Неуспешно възстановяване на блог статия.');

  await invalidateBlogCaches(articleId);

  return article;
}
