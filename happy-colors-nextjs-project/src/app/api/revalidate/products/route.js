import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const productId = typeof body?.productId === 'string' ? body.productId.trim() : '';

    revalidateTag('products');
    revalidatePath('/products');

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
