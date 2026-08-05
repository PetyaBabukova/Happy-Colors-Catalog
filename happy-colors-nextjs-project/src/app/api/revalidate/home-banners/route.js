import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

import { requireApiAuth, requireApiFullAdmin } from '../../_lib/auth';
import { revalidateLocalizedPath } from '../_lib/localizedPaths';

export async function POST(request) {
  try {
    const auth = requireApiFullAdmin(await requireApiAuth(request));

    if (!auth.ok) {
      return NextResponse.json({ message: auth.message }, { status: auth.status });
    }

    revalidateTag('home-banners');
    revalidateLocalizedPath('/');

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error in /api/revalidate/home-banners:', error);

    return NextResponse.json(
      { message: 'Грешка при обновяване на кеша на homepage банерите.' },
      { status: 500 }
    );
  }
}
