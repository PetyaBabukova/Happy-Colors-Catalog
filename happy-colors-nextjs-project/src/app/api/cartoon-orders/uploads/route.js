import { NextResponse } from 'next/server';

import {
  CARTOON_ORDER_UPLOAD_SESSION_PURPOSE,
  createUploadConfirmationToken,
  verifyCartoonOrderUploadToken,
} from '../../_lib/cartoonOrderUploadToken';
import { appendCartoonUploadedObject } from '../../_lib/cartoonUploadSessionStore';
import {
  checkCartoonUploadRateLimit,
  validateCartoonUploadSameOrigin,
} from '../../_lib/cartoonOrderUploadSecurity';
import {
  buildStorageObjectName,
  getCartoonOrdersBucketName,
  getStorage,
} from '../../_lib/gcs';
import { validateCartoonOrderPhotoFile } from '../../_lib/uploadValidation';
import {
  CARTOON_ORDER_PHOTO_PREFIX,
  MAX_CARTOON_ORDER_PHOTO_SIZE_BYTES,
} from '@/config/productLimits';
import { isCartoonsServiceEnabled } from '@/config/cartoonsFeature';

export const runtime = 'nodejs';

function jsonNoStore(body, init = {}) {
  const response = NextResponse.json(body, init);

  response.headers.set('Cache-Control', 'no-store');
  return response;
}

function getUploadSessionToken(formData) {
  return String(formData.get('uploadSessionToken') || '').trim();
}

function getContentLength(request) {
  const rawContentLength = request?.headers?.get?.('content-length');

  if (!rawContentLength) {
    return null;
  }

  if (!/^\d+$/.test(rawContentLength)) {
    return Number.NaN;
  }

  const contentLength = Number.parseInt(rawContentLength, 10);

  return Number.isSafeInteger(contentLength) ? contentLength : Number.NaN;
}

async function cleanupSavedObject({ fileRef, objectName }) {
  if (!fileRef || !objectName) {
    return;
  }

  try {
    await fileRef.delete({ ignoreNotFound: true });
  } catch (cleanupError) {
    console.error('Error cleaning up failed cartoon order upload:', cleanupError);
  }
}

export async function POST(request) {
  let savedObjectName = '';
  let savedFileRef = null;
  let uploadRecorded = false;

  try {
    if (!isCartoonsServiceEnabled) {
      return jsonNoStore({ message: 'Cartoon order uploads are not available.' }, { status: 404 });
    }

    const originValidation = validateCartoonUploadSameOrigin(request);

    if (!originValidation.ok) {
      return jsonNoStore({ message: originValidation.message }, { status: originValidation.status });
    }

    const coarseRateLimit = checkCartoonUploadRateLimit(request, '', { limit: 60 });

    if (!coarseRateLimit.ok) {
      return jsonNoStore({ message: coarseRateLimit.message }, { status: coarseRateLimit.status });
    }

    const contentLength = getContentLength(request);

    if (Number.isNaN(contentLength)) {
      return jsonNoStore({ message: 'Upload content length is invalid.' }, { status: 400 });
    }

    if (process.env.NODE_ENV === 'production' && contentLength === null) {
      return jsonNoStore({ message: 'Upload content length is required.' }, { status: 411 });
    }

    if (contentLength !== null && contentLength > MAX_CARTOON_ORDER_PHOTO_SIZE_BYTES + 64 * 1024) {
      return jsonNoStore({ message: 'Upload body is too large.' }, { status: 413 });
    }

    const bucketName = getCartoonOrdersBucketName();

    if (!bucketName) {
      return jsonNoStore(
        { message: 'Cartoon order storage bucket is not configured.' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const uploadSessionToken = getUploadSessionToken(formData);
    const sessionVerification = verifyCartoonOrderUploadToken({
      token: uploadSessionToken,
      purpose: CARTOON_ORDER_UPLOAD_SESSION_PURPOSE,
    });

    if (!sessionVerification.ok) {
      return jsonNoStore({ message: sessionVerification.message }, { status: 401 });
    }

    const sessionId = sessionVerification.payload.sessionId;
    const rateLimit = checkCartoonUploadRateLimit(request, sessionId);

    if (!rateLimit.ok) {
      return jsonNoStore({ message: rateLimit.message }, { status: rateLimit.status });
    }

    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return jsonNoStore({ message: 'Missing upload file.' }, { status: 400 });
    }

    if (
      !Number.isFinite(Number(file.size)) ||
      Number(file.size) <= 0 ||
      Number(file.size) > MAX_CARTOON_ORDER_PHOTO_SIZE_BYTES
    ) {
      return jsonNoStore({ message: 'Image is too large. Maximum size: 3 MB.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const validationResult = validateCartoonOrderPhotoFile(file, buffer);

    if (!validationResult.ok) {
      return jsonNoStore(
        { message: validationResult.message },
        { status: validationResult.status }
      );
    }

    const objectName = buildStorageObjectName(
      CARTOON_ORDER_PHOTO_PREFIX,
      file.name,
      validationResult.mimeType
    );

    const bucket = getStorage().bucket(bucketName);
    const fileRef = bucket.file(objectName);

    savedObjectName = objectName;
    savedFileRef = fileRef;

    await fileRef.save(buffer, {
      resumable: false,
      metadata: {
        contentType: validationResult.mimeType,
      },
    });

    const uploadedAt = new Date();
    const uploadConfirmationToken = createUploadConfirmationToken({
      sessionId,
      objectName,
      contentType: validationResult.mimeType,
      size: buffer.length,
    });
    const appendResult = await appendCartoonUploadedObject({
      sessionId,
      objectName,
      contentType: validationResult.mimeType,
      size: buffer.length,
      originalName: file.name,
      uploadedAt,
    });

    if (!appendResult.ok) {
      await cleanupSavedObject({ fileRef, objectName });

      const reason = appendResult.reason || 'unknown';
      const messages = {
        duplicate: 'This photo has already been uploaded in the current session.',
        expired: 'Upload session is expired. Please select the photos again.',
        full: 'Upload session already contains the maximum number of photos.',
        unknown: 'Upload session could not accept this file.',
      };

      return jsonNoStore(
        {
          message: messages[reason] || messages.unknown,
          code: `upload_session_${reason}`,
        },
        { status: 409 }
      );
    }

    uploadRecorded = true;

    return jsonNoStore(
      {
        objectName,
        uploadConfirmationToken,
        contentType: validationResult.mimeType,
        size: buffer.length,
        originalName: file.name,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in /api/cartoon-orders/uploads:', error);

    if (!uploadRecorded) {
      await cleanupSavedObject({ fileRef: savedFileRef, objectName: savedObjectName });
    }

    return jsonNoStore({ message: 'Cartoon order upload failed.' }, { status: 500 });
  }
}
