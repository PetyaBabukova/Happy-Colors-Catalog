import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';

import { requireApiAuth, requireApiFullAdmin } from '../../_lib/auth';

function hasValidRevalidateSecret(request) {
  const secret = String(process.env.PRODUCT_REVALIDATE_SECRET || process.env.REVALIDATE_SECRET || '').trim();
  const provided = String(request.headers.get('x-revalidate-secret') || '').trim();

  return Boolean(secret && provided && provided === secret);
}

export async function POST(request) {
  try {
    if (!hasValidRevalidateSecret(request)) {
      const auth = requireApiFullAdmin(await requireApiAuth(request));

      if (!auth.ok) {
        return NextResponse.json({ message: auth.message }, { status: auth.status });
      }
    }

    const body = await request.json().catch(() => ({}));
    const productId = typeof body?.productId === 'string' ? body.productId.trim() : '';

    revalidateTag('products');
    revalidateTag('homepage-featured-products');
    revalidatePath('/products');
    revalidatePath('/');
    revalidatePath('/sitemap.xml');

    if (productId) {
      revalidatePath(`/products/${productId}`);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error in /api/revalidate/products:', error);

    return NextResponse.json(
      { message: 'Грешка при обновяване на кеша на продуктите.' },
      { status: 500 }
    );
  }
}
