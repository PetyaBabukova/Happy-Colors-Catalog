import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let connect;
let disconnect;

async function loadScript() {
  return import('../../../../scripts/reportEnglishLaunchReadiness.js');
}

function createModel(entities = []) {
  return {
    find: vi.fn(() => ({
      sort: vi.fn(async () => entities),
    })),
  };
}

function createRequiredNormalizer(fields = []) {
  return (payload = {}) => {
    const normalized = {};

    for (const field of fields) {
      const value = String(payload[field] ?? '').trim();

      if (!value) {
        throw new Error(`${field} is required.`);
      }

      normalized[field] = value;
    }

    return normalized;
  };
}

function createConfigs({
  products = [],
  categories = [],
  blogArticles = [],
  homeBanners = [],
} = {}) {
  return {
    product: {
      entityType: 'product',
      activation: 'active',
      translationFields: ['title', 'description'],
      normalizeTranslation: createRequiredNormalizer(['title', 'description']),
      model: createModel(products),
      buildPublicFilter: vi.fn(() => ({ publicationStatus: 'published' })),
    },
    category: {
      entityType: 'category',
      activation: 'active',
      translationFields: ['name'],
      normalizeTranslation: createRequiredNormalizer(['name']),
      model: createModel(categories),
    },
    blogArticle: {
      entityType: 'blogArticle',
      activation: 'draft',
      translationFields: ['title', 'contentHtml', 'heroImageAlt'],
      normalizeTranslation: createRequiredNormalizer(['title', 'contentHtml', 'heroImageAlt']),
      model: createModel(blogArticles),
      buildPublicFilter: vi.fn(() => ({ archivedAt: null, status: 'published' })),
    },
    homeBanner: {
      entityType: 'homeBanner',
      activation: 'draft',
      sourceFields: ['title', 'description', 'ctaLabel'],
      translationFields: ['title', 'description', 'ctaLabel'],
      normalizeTranslation: createRequiredNormalizer(['title', 'description', 'ctaLabel']),
      model: createModel(homeBanners),
      buildPublicFilter: vi.fn(() => ({ isActive: true })),
    },
  };
}

function currentTranslation(sourceRevision, fields) {
  return new Map([
    [
      'en',
      {
        ...fields,
        sourceRevision,
        translationRevision: 1,
        method: 'manual',
      },
    ],
  ]);
}

function currentDraft(sourceRevision, fields) {
  return new Map([
    [
      'en',
      {
        ...fields,
        sourceRevision,
        translationRevision: 1,
        draftRevision: 1,
        method: 'machine',
      },
    ],
  ]);
}

describe('reportEnglishLaunchReadiness script', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    connect = vi.fn(async () => {});
    disconnect = vi.fn(async () => {});

    vi.doMock('../../../../server/mongoose.js', () => ({
      default: {
        connect,
        disconnect,
      },
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('reports ready when launch-critical content has current English translations and reviewed category slugs', async () => {
    const { reportEnglishLaunchReadiness } = await loadScript();
    const result = await reportEnglishLaunchReadiness({
      configs: createConfigs({
        products: [
          {
            _id: 'product-ready',
            sourceRevision: 2,
            title: 'Secret product source',
            translations: currentTranslation(2, {
              title: 'English product',
              description: 'English description',
            }),
          },
        ],
        categories: [
          {
            _id: 'category-ready',
            sourceRevision: 1,
            canonicalSlug: 'paintings',
            canonicalSlugReviewed: true,
            translations: currentTranslation(1, {
              name: 'Paintings',
            }),
          },
        ],
        blogArticles: [
          {
            _id: 'blog-ready',
            sourceRevision: 3,
            translations: currentTranslation(3, {
              title: 'English article',
              contentHtml: '<p>English body</p>',
              heroImageAlt: 'English image alt',
            }),
          },
        ],
        homeBanners: [
          {
            _id: 'banner-ready',
            sourceRevision: 4,
            placement: 'home',
            translations: currentTranslation(4, {
              title: 'English banner',
              description: 'English banner text',
              ctaLabel: 'See more',
            }),
          },
        ],
      }),
    });

    expect(result.ready).toBe(true);
    expect(result.totals.blockerCount).toBe(0);
    expect(result.entityTypes.product.current).toBe(1);
    expect(result.categorySlugs.reviewed).toBe(1);
    expect(result.bannerPlacements.readyPlacements).toBe(1);
    expect(JSON.stringify(result)).not.toContain('Secret product source');
  }, 15000);

  it('fails closed for missing translations, pending drafts, unresolved slugs, and empty banner placements', async () => {
    const { reportEnglishLaunchReadiness } = await loadScript();
    const result = await reportEnglishLaunchReadiness({
      configs: createConfigs({
        products: [
          {
            _id: 'product-missing',
            sourceRevision: 2,
          },
        ],
        categories: [
          {
            _id: 'category-unreviewed',
            sourceRevision: 1,
            canonicalSlug: 'paintings',
            canonicalSlugReviewed: false,
            translations: currentTranslation(1, {
              name: 'Paintings',
            }),
          },
        ],
        blogArticles: [
          {
            _id: 'blog-pending',
            sourceRevision: 3,
            translationDrafts: currentDraft(3, {
              title: 'English draft',
              contentHtml: '<p>English body</p>',
              heroImageAlt: 'English image alt',
            }),
          },
        ],
        homeBanners: [
          {
            _id: 'banner-missing',
            sourceRevision: 4,
            placement: 'home',
          },
        ],
      }),
    });

    expect(result.ready).toBe(false);
    expect(result.entityTypes.product.missing).toBe(1);
    expect(result.entityTypes.blogArticle.pendingReview).toBe(1);
    expect(result.categorySlugs.unreviewed).toBe(1);
    expect(result.bannerPlacements.blockedPlacements).toBe(1);
    expect(result.bannerPlacements.placements.home.missing).toBe(1);
    expect(result.blockers.map((blocker) => blocker.type)).toEqual(
      expect.arrayContaining([
        'missing_translation',
        'pending_review',
        'unreviewed_category_canonical_slug',
        'missing_translation',
      ])
    );
  });

  it('fails closed when active translations are outdated or invalid', async () => {
    const { reportEnglishLaunchReadiness } = await loadScript();
    const result = await reportEnglishLaunchReadiness({
      requiredBannerPlacements: [],
      configs: createConfigs({
        products: [
          {
            _id: 'product-outdated',
            sourceRevision: 2,
            translations: currentTranslation(1, {
              title: 'Old English product',
              description: 'Old English description',
            }),
          },
          {
            _id: 'product-invalid',
            sourceRevision: 1,
            translations: currentTranslation(1, {
              title: 'Incomplete English product',
            }),
          },
        ],
      }),
    });

    expect(result.ready).toBe(false);
    expect(result.entityTypes.product.outdated).toBe(1);
    expect(result.entityTypes.product.invalid).toBe(1);
    expect(result.blockers.map((blocker) => blocker.type)).toEqual(
      expect.arrayContaining(['outdated_translation', 'invalid_translation'])
    );
  });

  it('uses runtime blog validation so articles without rendered English content block launch', async () => {
    const configs = createConfigs({
      blogArticles: [
        {
          _id: 'blog-empty-content',
          sourceRevision: 3,
          translations: currentTranslation(3, {
            title: 'English article',
            contentHtml: '',
            heroImageAlt: 'English image alt',
          }),
        },
      ],
    });
    configs.blogArticle.normalizeTranslation = createRequiredNormalizer(['title', 'heroImageAlt']);

    const { reportEnglishLaunchReadiness } = await loadScript();
    const result = await reportEnglishLaunchReadiness({
      requiredBannerPlacements: [],
      configs,
    });

    expect(result.ready).toBe(false);
    expect(result.entityTypes.blogArticle.invalid).toBe(1);
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'invalid_translation',
          entityType: 'blogArticle',
          entityId: 'blog-empty-content',
          reason: 'Active English translation failed runtime public projection validation.',
        }),
      ])
    );
  });

  it('fails closed when the default required home banner placement has no active English banner', async () => {
    const { reportEnglishLaunchReadiness } = await loadScript();
    const result = await reportEnglishLaunchReadiness({
      configs: createConfigs(),
    });

    expect(result.ready).toBe(false);
    expect(result.bannerPlacements.totalRequiredPlacements).toBe(1);
    expect(result.bannerPlacements.blockedPlacements).toBe(1);
    expect(result.bannerPlacements.placements.home.activeBannerCount).toBe(0);
    expect(result.blockers.map((blocker) => blocker.type)).toContain(
      'missing_required_banner_placement_translation'
    );
  });

  it('marks a banner placement blocked when one active banner is current but another is missing English', async () => {
    const { reportEnglishLaunchReadiness } = await loadScript();
    const result = await reportEnglishLaunchReadiness({
      configs: createConfigs({
        homeBanners: [
          {
            _id: 'banner-current',
            sourceRevision: 1,
            placement: 'home',
            translations: currentTranslation(1, {
              title: 'English banner',
              description: 'English banner text',
              ctaLabel: 'See more',
            }),
          },
          {
            _id: 'banner-missing',
            sourceRevision: 1,
            placement: 'home',
          },
        ],
      }),
    });

    expect(result.ready).toBe(false);
    expect(result.bannerPlacements.readyPlacements).toBe(0);
    expect(result.bannerPlacements.blockedPlacements).toBe(1);
    expect(result.bannerPlacements.placements.home.currentActiveEnglishBannerCount).toBe(1);
    expect(result.bannerPlacements.placements.home.missing).toBe(1);
  });

  it('accepts current empty translation copy for an image-only cartoon placement', async () => {
    const configs = createConfigs({
      homeBanners: [
        {
          _id: 'cartoon-banner-current',
          sourceRevision: 1,
          placement: 'cartoons',
          title: '',
          description: '',
          ctaLabel: '',
          translations: currentTranslation(1, {
            title: '',
            description: '',
            ctaLabel: '',
          }),
        },
      ],
    });
    configs.homeBanner.normalizeTranslation = vi.fn((fields) => fields);
    const { reportEnglishLaunchReadiness } = await loadScript();
    const result = await reportEnglishLaunchReadiness({
      configs,
      requiredBannerPlacements: ['cartoons'],
    });

    expect(result.ready).toBe(true);
    expect(result.bannerPlacements.placements.cartoons.ready).toBe(true);
    expect(result.bannerPlacements.placements.cartoons.currentActiveEnglishBannerCount).toBe(1);
    expect(configs.homeBanner.normalizeTranslation).toHaveBeenCalledWith(
      expect.objectContaining({ title: '', description: '', ctaLabel: '' }),
      { entity: expect.objectContaining({ placement: 'cartoons' }) }
    );
    expect(configs.homeBanner.model.find).toHaveBeenCalledWith(
      { isActive: true },
      expect.objectContaining({
        title: 1,
        description: 1,
        ctaLabel: 1,
      })
    );
  });

  it('blocks current empty English copy when the Bulgarian banner has text', async () => {
    const configs = createConfigs({
      homeBanners: [
        {
          _id: 'text-banner-empty-translation',
          sourceRevision: 1,
          placement: 'home',
          title: 'Bulgarian title',
          description: 'Bulgarian description',
          ctaLabel: 'Bulgarian CTA',
          translations: currentTranslation(1, {
            title: '',
            description: '',
            ctaLabel: '',
          }),
        },
      ],
    });
    const { reportEnglishLaunchReadiness } = await loadScript();
    const result = await reportEnglishLaunchReadiness({ configs });

    expect(result.ready).toBe(false);
    expect(result.bannerPlacements.placements.home.invalid).toBe(1);
  });

  it('blocks a banner placement when the only current English content is still a draft', async () => {
    const { reportEnglishLaunchReadiness } = await loadScript();
    const result = await reportEnglishLaunchReadiness({
      configs: createConfigs({
        homeBanners: [
          {
            _id: 'banner-pending',
            sourceRevision: 1,
            placement: 'home',
            translationDrafts: currentDraft(1, {
              title: 'English draft banner',
              description: 'English draft text',
              ctaLabel: 'Preview',
            }),
          },
        ],
      }),
    });

    expect(result.ready).toBe(false);
    expect(result.bannerPlacements.blockedPlacements).toBe(1);
    expect(result.bannerPlacements.placements.home.pendingReview).toBe(1);
    expect(result.blockers.map((blocker) => blocker.type)).toContain('pending_review');
  });

  it('rejects unsupported translation locales', async () => {
    const { reportEnglishLaunchReadiness } = await loadScript();

    await expect(
      reportEnglishLaunchReadiness({
        locale: 'fr',
        configs: createConfigs(),
      })
    ).rejects.toThrow('Unsupported translation locale.');
  });

  it('does not load env files and fails before connecting when MONGO_URI is absent', async () => {
    vi.stubEnv('MONGO_URI', '');
    const stderr = vi.fn();
    const { runReportEnglishLaunchReadinessCli } = await loadScript();

    await expect(
      runReportEnglishLaunchReadinessCli({
        stdout: vi.fn(),
        stderr,
      })
    ).resolves.toBe(1);

    expect(connect).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenCalledWith(
      'MONGO_URI is required in the current environment. This script does not load .env files.'
    );
  });

  it('connects with MONGO_URI from the current environment only', async () => {
    vi.stubEnv('MONGO_URI', 'mongodb://direct-env');
    const { reportEnglishLaunchReadinessFromEnv } = await loadScript();

    await expect(reportEnglishLaunchReadinessFromEnv({ configs: createConfigs() })).resolves.toMatchObject({
      dryRun: true,
    });

    expect(connect).toHaveBeenCalledWith('mongodb://direct-env');
    expect(disconnect).toHaveBeenCalled();
  });
});
