function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function toProductRevalidateUrl(value) {
  const normalized = normalizeBaseUrl(value);

  if (!normalized) {
    return '';
  }

  if (/\/api\/revalidate\/products$/i.test(normalized)) {
    return normalized;
  }

  return `${normalized}/api/revalidate/products`;
}

function buildRevalidateUrls() {
  const explicitUrls = String(process.env.PRODUCT_REVALIDATE_URLS || process.env.PRODUCT_REVALIDATE_URL || '')
    .split(',')
    .map(toProductRevalidateUrl)
    .filter(Boolean);

  const inferredUrls = [
    process.env.CLIENT_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEWSLETTER_PUBLIC_SITE_URL,
    process.env.PUBLIC_SITE_URL,
  ]
    .map(toProductRevalidateUrl)
    .filter(Boolean);

  return [...new Set([...explicitUrls, ...inferredUrls])];
}

function getRevalidateSecret() {
  return String(process.env.PRODUCT_REVALIDATE_SECRET || process.env.REVALIDATE_SECRET || '').trim();
}

export async function revalidateProductSurfaces({ productId } = {}) {
  const urls = buildRevalidateUrls();
  const secret = getRevalidateSecret();

  if (urls.length === 0 || !secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Product revalidation is not configured.');
    }

    return { skipped: true };
  }

  if (typeof fetch !== 'function') {
    return { skipped: true };
  }

  const body = JSON.stringify(productId ? { productId: String(productId) } : {});
  const results = await Promise.all(
    urls.map(async (url) => {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-revalidate-secret': secret,
          },
          body,
        });

        return { url, ok: response.ok, status: response.status };
      } catch (error) {
        console.error('Failed to revalidate product surfaces:', error?.message || error);
        return { url, ok: false, error: true };
      }
    })
  );

  return {
    ok: results.every((result) => result.ok),
    results,
  };
}
