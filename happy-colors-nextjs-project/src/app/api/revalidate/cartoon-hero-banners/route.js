import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';

import { requireApiAuth, requireApiFullAdmin } from '../../_lib/auth';

export async function POST(request) {
  try {
    const auth = requireApiFullAdmin(await requireApiAuth(request));

    if (!auth.ok) {
      return NextResponse.json({ message: auth.message }, { status: auth.status });
    }

    revalidateTag('cartoon-hero-banners');
    revalidatePath('/cartoons');

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error in /api/revalidate/cartoon-hero-banners:', error);

    return NextResponse.json(
      { message: 'Р“СЂРµС€РєР° РїСЂРё РѕР±РЅРѕРІСЏРІР°РЅРµ РЅР° РєРµС€Р° РЅР° С€Р°СЂР¶ Р±Р°РЅРµСЂРёС‚Рµ.' },
      { status: 500 }
    );
  }
}
