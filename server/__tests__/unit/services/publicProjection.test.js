import { describe, expect, it } from 'vitest';
import {
  hasValidHomeBannerTranslation,
  projectPublicHomeBanner,
} from '../../../services/localization/publicProjection.js';

function banner({
  source = {},
  translation = {},
  sourceRevision = 1,
} = {}) {
  return {
    _id: 'banner-1',
    placement: 'cartoons',
    title: '',
    description: '',
    ctaLabel: '',
    imageUrl: 'https://example.com/banner.webp',
    sourceRevision,
    ...source,
    translations: {
      en: {
        title: '',
        description: '',
        ctaLabel: '',
        sourceRevision,
        method: 'manual',
        ...translation,
      },
    },
  };
}

describe('home banner public projection', () => {
  it('accepts a fresh empty translation for an image-only banner', () => {
    const entity = banner();

    expect(hasValidHomeBannerTranslation(entity)).toBe(true);
    expect(projectPublicHomeBanner(entity, 'en')).toMatchObject({
      title: '',
      description: '',
      ctaLabel: '',
      contentLocale: 'en',
      translationPending: false,
    });
  });

  it.each([
    ['title', { title: 'Bulgarian title' }],
    ['description', { description: 'Bulgarian description' }],
    ['ctaLabel', { ctaLabel: 'Bulgarian CTA' }],
  ])('requires English %s when the Bulgarian source field has text', (fieldName, source) => {
    const entity = banner({ source });

    expect(hasValidHomeBannerTranslation(entity)).toBe(false);
    expect(projectPublicHomeBanner(entity, 'en')).toBeNull();
  });

  it('rejects an otherwise complete translation from an older source revision', () => {
    const entity = banner({
      source: { title: 'Bulgarian title' },
      translation: {
        title: 'English title',
        sourceRevision: 1,
      },
      sourceRevision: 2,
    });

    expect(hasValidHomeBannerTranslation(entity)).toBe(false);
  });
});
