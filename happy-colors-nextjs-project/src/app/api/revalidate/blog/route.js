import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';

import { requireApiAuth, requireApiFullAdmin } from '../../_lib/auth';
import { revalidateLocalizedPath } from '../_lib/localizedPaths';

const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 60;
const rateLimitStore = new Map();

export function resetBlogRevalidateRateLimit() {
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

  const key = `blog-revalidate:${auth.user?._id || getClientIp(request)}`;
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

export async function POST(request) {
  try {
    const auth = requireApiFullAdmin(await requireApiAuth(request));

    if (!auth.ok) {
      return NextResponse.json({ message: auth.message }, { status: auth.status });
    }

    const rateLimit = checkRateLimit(request, auth);

    if (!rateLimit.ok) {
      return NextResponse.json(
        { message: 'Too many blog revalidation requests. Please try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
        }
      );
    }

    let payload;

    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ message: 'Невалидно съдържание на заявката.' }, { status: 400 });
    }

    const articleId = String(payload?.articleId || '').trim();

    if (!OBJECT_ID_RE.test(articleId)) {
      return NextResponse.json({ message: 'Невалиден идентификатор на блог статия.' }, { status: 400 });
    }

    revalidateTag('blog-articles');
    revalidateLocalizedPath('/blog');
    revalidateLocalizedPath(`/blog/${articleId}`);
    revalidatePath('/sitemap.xml');

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error in /api/revalidate/blog:', error);

    return NextResponse.json(
      { message: 'Грешка при обновяване на blog cache-а.' },
      { status: 500 }
    );
  }
}
