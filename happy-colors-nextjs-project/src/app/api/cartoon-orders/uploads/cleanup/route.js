import { NextResponse } from 'next/server';

import {
  CARTOON_ORDER_UPLOAD_CONFIRMATION_PURPOSE,
  CARTOON_ORDER_UPLOAD_SESSION_PURPOSE,
  verifyCartoonOrderUploadToken,
} from '../../../_lib/cartoonOrderUploadToken';
import {
  acquireCartoonUploadCleanupLock,
  markCartoonUploadedObjectByteGaugeReleased,
  releaseCartoonUploadCleanupLock,
  removeCartoonUploadedObjectAfterCleanup,
} from '../../../_lib/cartoonUploadSessionStore';
import { decrementUploadByteQuotaForGuardRefs } from '../../../_lib/cartoonUploadQuotaGuards';
import {
  checkCartoonUploadRateLimit,
  validateCartoonUploadSameOrigin,
} from '../../../_lib/cartoonOrderUploadSecurity';
import {
  getCartoonOrdersBucketName,
  getStorage,
  isCartoonOrderPhotoObjectName,
} from '../../../_lib/gcs';
import { isCartoonsServiceEnabled } from '@/config/cartoonsFeature';

export const runtime = 'nodejs';

function jsonNoStore(body, init = {}) {
  const response = NextResponse.json(body, init);

  response.headers.set('Cache-Control', 'no-store');
  return response;
}

function isSafeNotFoundStorageError(error) {
  const code = String(error?.code || error?.statusCode || '').trim();
  const message = String(error?.message || '').toLowerCase();

  return code === '404' || message.includes('no such object') || message.includes('not found');
}

async function readCleanupBody(request) {
  try {
    const body = await request.json();

    return body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  } catch {
    return {};
  }
}

function verifyUploadSessionToken(uploadSessionToken) {
  return verifyCartoonOrderUploadToken({
    token: uploadSessionToken,
    purpose: CARTOON_ORDER_UPLOAD_SESSION_PURPOSE,
  });
}

function verifyCleanupConfirmationTokens({ tokens, sessionId }) {
  const objectNames = [];
  const seenObjectNames = new Set();

  for (const token of tokens) {
    const verification = verifyCartoonOrderUploadToken({
      token,
      purpose: CARTOON_ORDER_UPLOAD_CONFIRMATION_PURPOSE,
    });

    if (!verification.ok) {
      return { ok: false, status: 401, message: verification.message };
    }

    if (String(verification.payload?.sessionId || '') !== sessionId) {
      return { ok: false, status: 401, message: 'Upload token session mismatch.' };
    }

    const objectName = String(verification.payload?.objectName || '').trim();

    if (!isCartoonOrderPhotoObjectName(objectName)) {
      return { ok: false, status: 400, message: 'Invalid reference photo.' };
    }

    if (!seenObjectNames.has(objectName)) {
      seenObjectNames.add(objectName);
      objectNames.push(objectName);
    }
  }

  return { ok: true, objectNames };
}

async function deleteStorageObject(objectName) {
  const bucketName = getCartoonOrdersBucketName();

  if (!bucketName) {
    throw new Error('Cartoon order storage bucket is not configured.');
  }

  await getStorage().bucket(bucketName).file(objectName).delete({ ignoreNotFound: false });
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

    const body = await readCleanupBody(request);
    const uploadSessionToken = String(body.uploadSessionToken || '').trim();
    const uploadConfirmationTokens = Array.isArray(body.uploadConfirmationTokens)
      ? body.uploadConfirmationTokens.map((token) => String(token || '').trim()).filter(Boolean)
      : [];
    const sessionVerification = verifyUploadSessionToken(uploadSessionToken);

    if (!sessionVerification.ok) {
      return jsonNoStore({ message: sessionVerification.message }, { status: 401 });
    }

    if (uploadConfirmationTokens.length === 0) {
      return jsonNoStore({ message: 'Missing reference photos.' }, { status: 400 });
    }

    const sessionId = String(sessionVerification.payload?.sessionId || '');
    const rateLimit = checkCartoonUploadRateLimit(request, sessionId, { limit: 30 });

    if (!rateLimit.ok) {
      return jsonNoStore({ message: rateLimit.message }, { status: rateLimit.status });
    }

    const confirmationVerification = verifyCleanupConfirmationTokens({
      tokens: uploadConfirmationTokens,
      sessionId,
    });

    if (!confirmationVerification.ok) {
      return jsonNoStore(
        { message: confirmationVerification.message },
        { status: confirmationVerification.status }
      );
    }

    let deletedCount = 0;
    let failedCount = 0;

    for (const objectName of confirmationVerification.objectNames) {
      const lock = await acquireCartoonUploadCleanupLock({ sessionId, objectName });

      if (!lock.ok) {
        failedCount += 1;
        continue;
      }

      let storageDeletionProven = false;

      try {
        try {
          await deleteStorageObject(objectName);
        } catch (error) {
          if (!isSafeNotFoundStorageError(error)) {
            throw error;
          }
        }

        storageDeletionProven = true;
        const byteGaugeRelease = await markCartoonUploadedObjectByteGaugeReleased({
          sessionId,
          objectName,
          cleanupLockedAt: lock.cleanupLockedAt,
        });

        if (byteGaugeRelease.ok) {
          await decrementUploadByteQuotaForGuardRefs({
            guard: byteGaugeRelease.uploadedObject.guard,
            size: byteGaugeRelease.uploadedObject.size,
          }).catch(() => {});
        }

        const removeResult = await removeCartoonUploadedObjectAfterCleanup({
          sessionId,
          objectName,
          cleanupLockedAt: lock.cleanupLockedAt,
        });

        if (!removeResult.ok) {
          throw new Error('Cleaned storage object could not be removed from upload session.');
        }

        deletedCount += 1;
      } catch (error) {
        failedCount += 1;

        if (!storageDeletionProven) {
          await releaseCartoonUploadCleanupLock({
            sessionId,
            objectName,
            cleanupLockedAt: lock.cleanupLockedAt,
            failureCategory: isSafeNotFoundStorageError(error)
              ? 'storage_absence_ambiguous'
              : 'storage_delete_failed',
          }).catch(() => {});
        }
      }
    }

    const status = failedCount > 0 ? 409 : 200;

    return jsonNoStore({ deletedCount, failedCount }, { status });
  } catch (error) {
    console.error('Error in /api/cartoon-orders/uploads/cleanup:', {
      name: String(error?.name || 'Error').slice(0, 80),
      code: String(error?.code || error?.statusCode || 'UNKNOWN').slice(0, 40),
    });

    return jsonNoStore({ message: 'Cartoon order upload cleanup failed.' }, { status: 500 });
  }
}
