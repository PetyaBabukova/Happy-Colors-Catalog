import { NextResponse } from 'next/server';

import { requireApiAuth } from '../../_lib/auth';
import { connectToMongo } from '../../_lib/mongo';
import { createPublicUrl, getBucketName, getStorage } from '../../_lib/gcs';
import { verifyUploadDeleteToken } from '../../_lib/uploadDeleteToken';

export const runtime = 'nodejs';

const PRODUCTS_COLLECTION = 'products';

function isAllowedObjectName(objectName) {
  if (!objectName || typeof objectName !== 'string') {
    return false;
  }

  const pathParts = objectName.split('/').filter(Boolean);

  if (pathParts.includes('..') || pathParts.includes('.')) {
    return false;
  }

  return (
    objectName.startsWith('products/videos/') ||
    objectName.startsWith('products/posters/')
  );
}

async function isAttachedToProduct(publicUrl) {
  const mongoose = await connectToMongo();

  // Keep this raw collection lookup local to the rollback endpoint to avoid coupling
  // the Next API route to the Express-side Mongoose model bundle.
  const attachedProduct = await mongoose.connection.db.collection(PRODUCTS_COLLECTION).findOne({
    $or: [
      { imageUrl: publicUrl },
      { imageUrls: publicUrl },
      { 'videos.url': publicUrl },
      { 'videos.posterUrl': publicUrl },
    ],
  }, {
    projection: { _id: 1 },
  });

  return Boolean(attachedProduct);
}

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

    const objectName = String(payload?.objectName || '').trim();
    const deleteToken = String(payload?.deleteToken || '').trim();

    if (!isAllowedObjectName(objectName)) {
      return NextResponse.json(
        { message: 'Невалиден storage object за изтриване.' },
        { status: 400 }
      );
    }

    const tokenValidation = verifyUploadDeleteToken({
      token: deleteToken,
      objectName,
      userId: auth.user?._id,
    });

    if (!tokenValidation.ok) {
      return NextResponse.json(
        { message: 'Невалиден или изтекъл delete token за upload-а.' },
        { status: 403 }
      );
    }

    const publicUrl = createPublicUrl(bucketName, objectName);

    if (await isAttachedToProduct(publicUrl)) {
      return NextResponse.json(
        {
          message:
            'Този файл вече е записан към продукт и не може да се трие от rollback endpoint-а.',
        },
        { status: 409 }
      );
    }

    await getStorage().bucket(bucketName).file(objectName).delete({ ignoreNotFound: true });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error('Error in /api/uploads/delete:', error);

    return NextResponse.json(
      { message: 'Грешка при изтриване на качения файл.' },
      { status: 500 }
    );
  }
}
