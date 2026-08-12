import { NextResponse } from 'next/server';

import {
  requireApiActiveArtistOrFullAdmin,
  requireApiAuth,
  requireApiFullAdmin,
} from '../../_lib/auth';
import {
  buildStorageObjectName,
  createPublicUrl,
  getBucketName,
  getStorage,
} from '../../_lib/gcs';
import { createUploadDeleteToken } from '../../_lib/uploadDeleteToken';
import {
  validateImageUploadFile,
  validateVideoUploadFile,
} from '../../_lib/uploadValidation';

export const runtime = 'nodejs';

const KIND_CONFIG = {
  'home-banner-image': {
    folder: 'home-banners/images',
    validateFile: validateImageUploadFile,
  },
  'home-banner-mobile-image': {
    folder: 'home-banners/mobile-images',
    validateFile: validateImageUploadFile,
  },
  'product-image': {
    folder: 'products/images',
    validateFile: validateImageUploadFile,
  },
  video: {
    folder: 'products/videos',
    validateFile: validateVideoUploadFile,
  },
  poster: {
    folder: 'products/posters',
    validateFile: validateImageUploadFile,
  },
};

export async function POST(request) {
  try {
    const auth = await requireApiAuth(request);

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

    const formData = await request.formData();
    const kind = String(formData.get('kind') || '').trim().toLowerCase();
    const file = formData.get('file');

    if (!KIND_CONFIG[kind]) {
      return NextResponse.json({ message: 'Неподдържан тип upload.' }, { status: 400 });
    }

    const uploadAuth = kind === 'home-banner-image' || kind === 'home-banner-mobile-image'
      ? requireApiFullAdmin(auth)
      : requireApiActiveArtistOrFullAdmin(auth);

    if (!uploadAuth.ok) {
      return NextResponse.json({ message: uploadAuth.message }, { status: uploadAuth.status });
    }

    if (!file || typeof file === 'string') {
      return NextResponse.json({ message: 'Не е получен файл за качване.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const validationResult = KIND_CONFIG[kind].validateFile(file, buffer);

    if (!validationResult.ok) {
      return NextResponse.json(
        { message: validationResult.message },
        { status: validationResult.status }
      );
    }

    const objectName = buildStorageObjectName(
      KIND_CONFIG[kind].folder,
      file.name,
      validationResult.mimeType
    );
    const bucket = getStorage().bucket(bucketName);

    await bucket.file(objectName).save(buffer, {
      resumable: false,
      metadata: {
        contentType: validationResult.mimeType,
      },
    });

    return NextResponse.json(
      {
        publicUrl: createPublicUrl(bucketName, objectName),
        objectName,
        deleteToken: createUploadDeleteToken({
          objectName,
          userId: auth.user?._id,
        }),
        uploadMode: 'proxy',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in /api/uploads/proxy:', error);

    return NextResponse.json(
      { message: 'Грешка при proxy качване към storage.' },
      { status: 500 }
    );
  }
}
