import path from 'path';
import { NextResponse } from 'next/server';

import { requireApiAuth, requireApiFullAdmin } from '../../_lib/auth';
import {
  buildStorageObjectName,
  createPublicUrl,
  getBucketName,
  getStorage,
} from '../../_lib/gcs';
import { createUploadDeleteToken } from '../../_lib/uploadDeleteToken';
import { validateImageUploadFile } from '../../_lib/uploadValidation';

export const runtime = 'nodejs';

const HERO_FOLDER = 'blog/articles/hero';
const THUMBNAIL_FOLDER = 'blog/articles/thumbnails';
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 40;
const IMAGE_FOLDERS = {
  hero: HERO_FOLDER,
  thumbnail: THUMBNAIL_FOLDER,
};
const rateLimitStore = new Map();

export function resetBlogImageUploadRateLimit() {
  rateLimitStore.clear();
}

function getClientIp(request) {
  const forwardedFor = request.headers?.get?.('x-forwarded-for');

  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  return request.headers?.get?.('x-real-ip') || 'unknown';
}

function checkRateLimit(request, auth) {
  const now = Date.now();

  for (const [storedKey, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(storedKey);
    }
  }

  const key = `blog-article-images:${auth.user._id || getClientIp(request)}`;
  const existing = rateLimitStore.get(key);

  if (!existing || now > existing.resetAt) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });

    return { ok: true };
  }

  existing.count += 1;

  if (existing.count > RATE_LIMIT_MAX) {
    return {
      ok: false,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  return { ok: true };
}

function normalizeImageKind(kind) {
  return typeof kind === 'string' ? kind.trim().toLowerCase() : '';
}

async function cleanupUploadedBlogImage(bucket, objectName) {
  if (!objectName) {
    return;
  }

  try {
    await bucket.file(objectName).delete({ ignoreNotFound: true });
  } catch (error) {
    console.error('Error cleaning up blog image after upload failure:', error);
  }
}

export async function POST(request) {
  let objectName = null;
  let bucket = null;

  try {
    const auth = requireApiFullAdmin(await requireApiAuth(request));

    if (!auth.ok) {
      return NextResponse.json({ message: auth.message }, { status: auth.status });
    }

    if (!auth.user?._id) {
      return NextResponse.json({ message: 'Authenticated user id is missing.' }, { status: 401 });
    }

    const rateLimit = checkRateLimit(request, auth);

    if (!rateLimit.ok) {
      return NextResponse.json(
        { message: 'Too many blog image upload requests. Please try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
        }
      );
    }

    const bucketName = getBucketName();

    if (!bucketName) {
      return NextResponse.json(
        { message: 'Missing storage bucket configuration (GCS_BUCKET_NAME).' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const kind = normalizeImageKind(formData.get('kind'));
    const folder = IMAGE_FOLDERS[kind];

    if (!folder) {
      return NextResponse.json({ message: 'Invalid blog image upload type.' }, { status: 400 });
    }

    if (!file || typeof file === 'string') {
      return NextResponse.json({ message: 'No upload file was received.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const validationResult = validateImageUploadFile(file, buffer);

    if (!validationResult.ok) {
      return NextResponse.json(
        { message: validationResult.message },
        { status: validationResult.status }
      );
    }

    bucket = getStorage().bucket(bucketName);
    objectName = buildStorageObjectName(folder, path.basename(file.name || 'blog-image'), validationResult.mimeType);

    await bucket.file(objectName).save(buffer, {
      resumable: false,
      metadata: {
        contentType: validationResult.mimeType,
      },
    });

    return NextResponse.json(
      {
        kind,
        imageUrl: createPublicUrl(bucketName, objectName),
        objectName,
        deleteToken: createUploadDeleteToken({
          objectName,
          userId: auth.user?._id,
        }),
      },
      { status: 200 }
    );
  } catch (error) {
    if (bucket) {
      await cleanupUploadedBlogImage(bucket, objectName);
    }

    console.error('Error in /api/blog/images:', error);

    return NextResponse.json(
      { message: 'Error while uploading the blog image.' },
      { status: 500 }
    );
  }
}
