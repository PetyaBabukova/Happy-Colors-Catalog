import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';

import { requireApiAuth, requireApiFullAdmin } from '../../_lib/auth';

export async function POST(request) {
  try {
    const auth = requireApiFullAdmin(await requireApiAuth(request));

    if (!auth.ok) {
      return NextResponse.json({ message: auth.message }, { status: auth.status });
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
