import { NextResponse } from 'next/server';

import {
  requireApiActiveArtistOrFullAdmin,
  requireApiAuth,
  requireApiFullAdmin,
} from '../../_lib/auth';
import { connectToMongo } from '../../_lib/mongo';
import { createPublicUrl, getBucketName, getStorage } from '../../_lib/gcs';
import { verifyUploadDeleteToken } from '../../_lib/uploadDeleteToken';

export const runtime = 'nodejs';

const PRODUCTS_COLLECTION = 'products';
const BLOG_ARTICLES_COLLECTION = 'blogarticles';
const HOME_BANNERS_COLLECTION = 'homebanners';

function isAllowedObjectName(objectName) {
  if (!objectName || typeof objectName !== 'string') {
    return false;
  }

  const pathParts = objectName.split('/').filter(Boolean);

  if (pathParts.includes('..') || pathParts.includes('.')) {
    return false;
  }

  return (
    objectName.startsWith('home-banners/images/') ||
    objectName.startsWith('home-banners/mobile-images/') ||
    objectName.startsWith('products/images/') ||
    objectName.startsWith('products/videos/') ||
    objectName.startsWith('products/posters/') ||
    objectName.startsWith('blog/articles/hero/') ||
    objectName.startsWith('blog/articles/thumbnails/')
  );
}

async function isAttachedToPersistedContent(publicUrl) {
  const mongoose = await connectToMongo();

  // Keep these raw collection lookups local to avoid coupling this Next route
  // to the Express-side Mongoose model bundle.
  const [attachedProduct, attachedBlogArticle, attachedHomeBanner] = await Promise.all([
    mongoose.connection.db.collection(PRODUCTS_COLLECTION).findOne({
      $or: [
        { imageUrl: publicUrl },
        { imageUrls: publicUrl },
        { 'videos.url': publicUrl },
        { 'videos.posterUrl': publicUrl },
        { 'draftContent.imageUrl': publicUrl },
        { 'draftContent.imageUrls': publicUrl },
        { 'draftContent.videos.url': publicUrl },
        { 'draftContent.videos.posterUrl': publicUrl },
      ],
    }, {
      projection: { _id: 1 },
    }),
    mongoose.connection.db.collection(BLOG_ARTICLES_COLLECTION).findOne({
      $or: [
        { heroImageUrl: publicUrl },
        { thumbnailImageUrl: publicUrl },
      ],
    }, {
      projection: { _id: 1 },
    }),
    mongoose.connection.db.collection(HOME_BANNERS_COLLECTION).findOne({
      $or: [
        { imageUrl: publicUrl },
        { mobileImageUrl: publicUrl },
      ],
    }, {
      projection: { _id: 1 },
    }),
  ]);

  return Boolean(attachedProduct || attachedBlogArticle || attachedHomeBanner);
}

export async function POST(request) {
  try {
    const auth = await requireApiAuth(request);

    if (!auth.ok) {
      return NextResponse.json({ message: auth.message }, { status: auth.status });
    }

    const bucketName = getBucketName();

    if (!bucketName) {
      return NextResponse.json(
        { message: 'Липсва конфигурация на storage кофата (GCS_BUCKET_NAME).' },
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

    const uploadAuth = objectName.startsWith('blog/') || objectName.startsWith('home-banners/')
      ? requireApiFullAdmin(auth)
      : requireApiActiveArtistOrFullAdmin(auth);

    if (!uploadAuth.ok) {
      return NextResponse.json({ message: uploadAuth.message }, { status: uploadAuth.status });
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

    if (await isAttachedToPersistedContent(publicUrl)) {
      return NextResponse.json(
        {
          message:
            'Този файл вече е записан към съдържание и не може да се изтрие от rollback endpoint-а.',
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
