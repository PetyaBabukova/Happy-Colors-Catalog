import { revalidatePath } from 'next/cache';

import { SUPPORTED_LOCALES } from '@/i18n/config';
import { localizePath } from '@/i18n/routing';

export function getLocalizedRevalidationPaths(path, { includeLegacy = true } = {}) {
  const normalizedPath = String(path || '/').trim() || '/';
  const paths = new Set();

  if (includeLegacy) {
    paths.add(normalizedPath);
  }

  // Revalidate the locale superset so enabling or disabling locale route flags
  // does not leave a previously-rendered path stale.
  for (const locale of SUPPORTED_LOCALES) {
    paths.add(localizePath(normalizedPath, locale));
  }

  return [...paths];
}

export function revalidateLocalizedPath(path, options = {}) {
  for (const localizedPath of getLocalizedRevalidationPaths(path, options)) {
    revalidatePath(localizedPath);
  }
}
