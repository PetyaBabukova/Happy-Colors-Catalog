import { revalidateTag } from 'next/cache';

import { revalidateLocalizedPath } from '../_lib/localizedPaths';
import { createRevalidatePostHandler } from '../_lib/revalidateRoute';

function revalidateHomeBannerSurfaces() {
  revalidateTag('home-banners');
  revalidateLocalizedPath('/');
}

export const POST = createRevalidatePostHandler({
  routeLabel: '/api/revalidate/home-banners',
  secretEnvNames: ['HOME_BANNER_REVALIDATE_SECRET', 'REVALIDATE_SECRET'],
  allowInvalidJson: true,
  revalidate: revalidateHomeBannerSurfaces,
  errorMessage: 'Р“СЂРµС€РєР° РїСЂРё РѕР±РЅРѕРІСЏРІР°РЅРµ РЅР° РєРµС€Р° РЅР° homepage Р±Р°РЅРµСЂРёС‚Рµ.',
});
