import { NextResponse } from 'next/server';

import { requireApiAuth } from '../../_lib/auth';
import {
  buildStorageObjectName,
  createPublicUrl,
  getBucketName,
  getStorage,
} from '../../_lib/gcs';
import { createUploadDeleteToken } from '../../_lib/uploadDeleteToken';
import {
  ALLOWED_IMAGE_UPLOAD_MIME_TYPES,
  ALLOWED_VIDEO_MIME_TYPES,
  MAX_IMAGE_UPLOAD_SIZE_BYTES,
  MAX_VIDEO_UPLOAD_SIZE_BYTES,
} from '@/config/productLimits';

export const runtime = 'nodejs';

const SIGNED_UPLOAD_EXPIRATION_MS = 15 * 60 * 1000;

const KIND_CONFIG = {
  video: {
    folder: 'products/videos',
    allowedMimeTypes: new Set(ALLOWED_VIDEO_MIME_TYPES),
    maxSizeBytes: MAX_VIDEO_UPLOAD_SIZE_BYTES,
  },
  poster: {
    folder: 'products/posters',
    allowedMimeTypes: new Set(ALLOWED_IMAGE_UPLOAD_MIME_TYPES),
    maxSizeBytes: MAX_IMAGE_UPLOAD_SIZE_BYTES,
  },
};

export async function POST(request) {
  try {
    const auth = requireApiAuth(request);

    if (!auth.ok) {
      return NextResponse.json({ message: auth.message }, { status: auth.status });
    }

    const bucketName = getBucketName();

    if (!bucketName) {
      return NextResponse.json(
        { message: 'Липсва конфигурация на кофата (GCS_BUCKET_NAME).' },
        { status: 500 }
      );
    }

    let payload;

    try {
      payload = await request.json();
    } catch {
      return NextResponse.json(
        { message: 'Невалидно съдържание на заявката.' },
        { status: 400 }
      );
    }

    const kind = String(payload?.kind || '').trim().toLowerCase();
    const mimeType = String(payload?.mimeType || '').trim().toLowerCase();
    const fileName = String(payload?.fileName || '').trim();
    const fileSize = Number(payload?.fileSize || 0);

    if (!KIND_CONFIG[kind]) {
      return NextResponse.json({ message: 'Неподдържан тип upload.' }, { status: 400 });
    }

    const kindConfig = KIND_CONFIG[kind];

    if (!kindConfig.allowedMimeTypes.has(mimeType)) {
      return NextResponse.json(
        { message: 'Неподдържан MIME тип за този upload.' },
        { status: 400 }
      );
    }

    if (!fileName) {
      return NextResponse.json({ message: 'Липсва име на файла.' }, { status: 400 });
    }

    if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > kindConfig.maxSizeBytes) {
      return NextResponse.json(
        { message: 'Невалиден размер на файла за signed upload.' },
        { status: 400 }
      );
    }

    const objectName = buildStorageObjectName(kindConfig.folder, fileName, mimeType);
    const bucket = getStorage().bucket(bucketName);
    const file = bucket.file(objectName);

    const [postPolicy] = await file.generateSignedPostPolicyV4({
      expires: Date.now() + SIGNED_UPLOAD_EXPIRATION_MS,
      conditions: [
        ['eq', '$Content-Type', mimeType],
        ['content-length-range', 1, kindConfig.maxSizeBytes],
      ],
      fields: {
        'Content-Type': mimeType,
      },
    });

    return NextResponse.json(
      {
        uploadUrl: postPolicy.url,
        formFields: postPolicy.fields,
        publicUrl: createPublicUrl(bucketName, objectName),
        objectName,
        deleteToken: createUploadDeleteToken({
          objectName,
          userId: auth.user?._id,
        }),
        maxSizeBytes: kindConfig.maxSizeBytes,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in /api/uploads/sign:', error);

    return NextResponse.json(
      { message: 'Грешка при генериране на signed upload.' },
      { status: 500 }
    );
  }
}
