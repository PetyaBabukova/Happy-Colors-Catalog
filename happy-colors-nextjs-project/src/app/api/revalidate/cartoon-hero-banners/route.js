import { revalidateTag } from 'next/cache';

import { revalidateLocalizedPath } from '../_lib/localizedPaths';
import { createRevalidatePostHandler } from '../_lib/revalidateRoute';

function revalidateCartoonHeroBannerSurfaces() {
  revalidateTag('cartoon-hero-banners');
  revalidateLocalizedPath('/cartoons');
}

export const POST = createRevalidatePostHandler({
  routeLabel: '/api/revalidate/cartoon-hero-banners',
  secretEnvNames: ['CARTOON_HERO_BANNER_REVALIDATE_SECRET', 'REVALIDATE_SECRET'],
  allowInvalidJson: true,
  revalidate: revalidateCartoonHeroBannerSurfaces,
  errorMessage: 'Р вЂњРЎР‚Р ВµРЎв‚¬Р С”Р В° Р С—РЎР‚Р С‘ Р С•Р В±Р Р…Р С•Р Р†РЎРЏР Р†Р В°Р Р…Р Вµ Р Р…Р В° Р С”Р ВµРЎв‚¬Р В° Р Р…Р В° РЎв‚¬Р В°РЎР‚Р В¶ Р В±Р В°Р Р…Р ВµРЎР‚Р С‘РЎвЂљР Вµ.',
});
