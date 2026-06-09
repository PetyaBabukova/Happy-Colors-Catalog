import { NextResponse } from 'next/server';

import { createUploadSessionToken } from '../../_lib/cartoonOrderUploadToken';
import { createCartoonUploadSession } from '../../_lib/cartoonUploadSessionStore';
import {
  checkCartoonUploadSessionRateLimit,
  validateCartoonUploadSameOrigin,
} from '../../_lib/cartoonOrderUploadSecurity';
import {
  ALLOWED_CARTOON_ORDER_PHOTO_MIME_TYPES,
  MAX_CARTOON_ORDER_PHOTO_SIZE_BYTES,
  MAX_CARTOON_ORDER_PHOTOS,
} from '@/config/productLimits';
import { isCartoonsServiceEnabled } from '@/config/cartoonsFeature';

export const runtime = 'nodejs';

function jsonNoStore(body, init = {}) {
  const response = NextResponse.json(body, init);

  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function POST(request) {
  try {
    if (!isCartoonsServiceEnabled) {
      return jsonNoStore({ message: 'Cartoon order uploads are not available.' }, { status: 404 });
    }

    const originValidation = validateCartoonUploadSameOrigin(request);

    if (!originValidation.ok) {
      return jsonNoStore({ message: originValidation.message }, { status: originValidation.status });
    }

    const rateLimit = checkCartoonUploadSessionRateLimit(request);

    if (!rateLimit.ok) {
      return jsonNoStore({ message: rateLimit.message }, { status: rateLimit.status });
    }

    const uploadSession = await createCartoonUploadSession();
    const uploadSessionToken = createUploadSessionToken({
      sessionId: uploadSession.sessionId,
      expiresAt: uploadSession.expiresAt.getTime(),
    });

    return jsonNoStore(
      {
        uploadSessionToken,
        sessionId: uploadSession.sessionId,
        maxFiles: MAX_CARTOON_ORDER_PHOTOS,
        maxSizeBytes: MAX_CARTOON_ORDER_PHOTO_SIZE_BYTES,
        allowedMimeTypes: ALLOWED_CARTOON_ORDER_PHOTO_MIME_TYPES,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in /api/cartoon-orders/upload-session:', error);

    return jsonNoStore(
      { message: 'Upload session creation failed.' },
      { status: 500 }
    );
  }
}
