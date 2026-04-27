import { NextResponse } from 'next/server';

import { requireApiAuth } from '@/app/api/_lib/auth';
import {
  buildStorageObjectName,
  createPublicUrl,
  getBucketName,
  getStorage,
} from '@/app/api/_lib/gcs';
import { validateImageUploadFile } from '@/app/api/_lib/uploadValidation';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const authResult = requireApiAuth(request);

    if (!authResult.ok) {
      return NextResponse.json(
        { message: authResult.message },
        { status: authResult.status }
      );
    }

    const bucketName = getBucketName();

    if (!bucketName) {
      return NextResponse.json(
        { message: 'Липсва конфигурация на кофата (GCS_BUCKET_NAME).' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { message: 'Не е получен файл за качване.' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const validationResult = validateImageUploadFile(file, buffer);

    if (!validationResult.ok) {
      return NextResponse.json(
        { message: validationResult.message },
        { status: validationResult.status }
      );
    }

    const objectName = buildStorageObjectName(
      'products',
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
      { imageUrl: createPublicUrl(bucketName, objectName) },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in /api/upload-image:', error);

    return NextResponse.json(
      { message: 'Грешка при качване на изображението.' },
      { status: 500 }
    );
  }
}
