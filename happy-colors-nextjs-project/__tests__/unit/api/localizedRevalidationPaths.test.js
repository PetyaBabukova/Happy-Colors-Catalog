import { describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('localized revalidation paths', () => {
  it('returns legacy and localized paths with stable deduping', async () => {
    const { getLocalizedRevalidationPaths } = await import(
      '../../../src/app/api/revalidate/_lib/localizedPaths.js'
    );

    expect(getLocalizedRevalidationPaths('/')).toEqual(['/', '/bg', '/en']);
    expect(getLocalizedRevalidationPaths('/products')).toEqual([
      '/products',
      '/bg/products',
      '/en/products',
    ]);
    expect(getLocalizedRevalidationPaths('/bg/products')).toEqual([
      '/bg/products',
      '/en/products',
    ]);
  });

  it('can omit the legacy path for locale-only callers', async () => {
    const { getLocalizedRevalidationPaths } = await import(
      '../../../src/app/api/revalidate/_lib/localizedPaths.js'
    );

    expect(getLocalizedRevalidationPaths('/products', { includeLegacy: false })).toEqual([
      '/bg/products',
      '/en/products',
    ]);
  });

  it('revalidates every derived path', async () => {
    const { revalidatePath } = await import('next/cache');
    const { revalidateLocalizedPath } = await import(
      '../../../src/app/api/revalidate/_lib/localizedPaths.js'
    );

    revalidateLocalizedPath('/blog/article-1');

    expect(revalidatePath).toHaveBeenCalledWith('/blog/article-1');
    expect(revalidatePath).toHaveBeenCalledWith('/bg/blog/article-1');
    expect(revalidatePath).toHaveBeenCalledWith('/en/blog/article-1');
  });
});
