function buildRevalidateUrl() {
  const explicitUrl = String(process.env.PRODUCT_REVALIDATE_URL || '').trim();

  if (explicitUrl) {
    return explicitUrl;
  }

  const clientUrl = String(process.env.CLIENT_URL || '').replace(/\/$/, '');

  return clientUrl ? `${clientUrl}/api/revalidate/products` : '';
}

function getRevalidateSecret() {
  return String(process.env.PRODUCT_REVALIDATE_SECRET || process.env.REVALIDATE_SECRET || '').trim();
}

export async function revalidateProductSurfaces({ productId } = {}) {
  const url = buildRevalidateUrl();
  const secret = getRevalidateSecret();

  if (!url || !secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Product revalidation is not configured.');
    }

    return { skipped: true };
  }

  if (typeof fetch !== 'function') {
    return { skipped: true };
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-revalidate-secret': secret,
      },
      body: JSON.stringify(productId ? { productId: String(productId) } : {}),
    });

    return { ok: response.ok, status: response.status };
  } catch (error) {
    console.error('Failed to revalidate product surfaces:', error?.message || error);
    return { ok: false, error: true };
  }
}
