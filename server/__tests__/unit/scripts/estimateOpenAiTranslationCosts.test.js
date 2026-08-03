import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let connect;
let disconnect;

async function loadScript() {
  return import('../../../../scripts/estimateOpenAiTranslationCosts.js');
}

function createConfig({ entityType = 'product', activation = 'active', entities = [] } = {}) {
  return {
    [entityType]: {
      entityType,
      activation,
      sourceFields: ['title', 'description'],
      translationFields: ['title', 'description'],
      providerFields: ['title', 'description'],
      model: {
        find: vi.fn(() => ({
          sort: vi.fn(async () => entities),
        })),
      },
    },
  };
}

describe('estimateOpenAiTranslationCosts script', () => {
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

  it('estimates token usage without exposing source text in the aggregate result', async () => {
    const { estimateOpenAiTranslationCosts } = await loadScript();
    const result = await estimateOpenAiTranslationCosts({
      configs: createConfig({
        entities: [
          {
            sourceRevision: 2,
            title: 'Secret product title',
            description: 'Private Bulgarian source body',
          },
        ],
      }),
    });

    expect(result.totals.allEligible.entityCount).toBe(1);
    expect(result.totals.pendingOnly.entityCount).toBe(1);
    expect(result.totals.pendingOnly.inputTokens).toBeGreaterThan(0);
    expect(result.totals.pendingOnly.outputTokens).toBeGreaterThan(0);
    expect(JSON.stringify(result)).not.toContain('Secret product title');
    expect(JSON.stringify(result)).not.toContain('Private Bulgarian source body');
  }, 15000);

  it('excludes current active translations from the pending-only estimate', async () => {
    const { estimateOpenAiTranslationCosts } = await loadScript();
    const result = await estimateOpenAiTranslationCosts({
      configs: createConfig({
        entities: [
          {
            sourceRevision: 3,
            title: 'Current',
            description: 'Already translated',
            translations: new Map([
              ['en', { sourceRevision: 3, title: 'Current', description: 'Already translated' }],
            ]),
          },
          {
            sourceRevision: 4,
            title: 'Pending',
            description: 'Needs machine generation',
            translations: new Map([
              ['en', { sourceRevision: 2, title: 'Old', description: 'Old' }],
            ]),
          },
        ],
      }),
    });

    expect(result.entityTypes.product.currentCount).toBe(1);
    expect(result.entityTypes.product.machineCandidateCount).toBe(1);
    expect(result.totals.allEligible.entityCount).toBe(2);
    expect(result.totals.pendingOnly.entityCount).toBe(1);
  });

  it('excludes current drafts from the pending-only estimate for draft-activation entities', async () => {
    const { estimateOpenAiTranslationCosts } = await loadScript();
    const result = await estimateOpenAiTranslationCosts({
      configs: createConfig({
        entityType: 'blogArticle',
        activation: 'draft',
        entities: [
          {
            sourceRevision: 5,
            title: 'Draft ready',
            description: 'Already generated draft',
            translationDrafts: new Map([
              ['en', { sourceRevision: 5, title: 'Draft ready', description: 'Already generated draft' }],
            ]),
          },
        ],
      }),
    });

    expect(result.entityTypes.blogArticle.currentDraftCount).toBe(1);
    expect(result.entityTypes.blogArticle.machineCandidateCount).toBe(0);
    expect(result.totals.pendingOnly.entityCount).toBe(0);
  });

  it('treats current drafts on active-activation entities as machine candidates', async () => {
    const { estimateOpenAiTranslationCosts } = await loadScript();
    const result = await estimateOpenAiTranslationCosts({
      configs: createConfig({
        activation: 'active',
        entities: [
          {
            sourceRevision: 5,
            title: 'Draft does not activate',
            description: 'Products need active translations',
            translationDrafts: new Map([
              [
                'en',
                {
                  sourceRevision: 5,
                  title: 'Draft does not activate',
                  description: 'Products need active translations',
                },
              ],
            ]),
          },
        ],
      }),
    });

    expect(result.entityTypes.product.currentDraftCount).toBe(0);
    expect(result.entityTypes.product.machineCandidateCount).toBe(1);
    expect(result.totals.pendingOnly.entityCount).toBe(1);
  });

  it('pins token and model cost estimates for a known payload', async () => {
    const { estimateEntityTokens, estimateOpenAiTranslationCosts } = await loadScript();

    expect(
      estimateEntityTokens({
        entityType: 'product',
        sourceFields: { title: 'A', description: 'BC' },
        fields: ['title', 'description'],
      })
    ).toEqual({
      sourceCharacters: 3,
      inputTokens: 256,
      outputTokens: 35,
    });

    const result = await estimateOpenAiTranslationCosts({
      configs: createConfig({
        entities: [{ title: 'A', description: 'BC' }],
      }),
    });

    expect(result.totals.pendingOnly.estimatedUsd).toEqual({
      'gpt-5.6-sol': 0.00233,
      'gpt-5.6-terra': 0.001165,
      'gpt-5.6-luna': 0.000466,
    });
  });

  it('rejects unsupported translation locales', async () => {
    const { estimateOpenAiTranslationCosts } = await loadScript();

    await expect(
      estimateOpenAiTranslationCosts({
        locale: 'fr',
        configs: {},
      })
    ).rejects.toThrow('Unsupported translation locale.');
  });

  it('does not load env files and fails before connecting when MONGO_URI is absent', async () => {
    vi.stubEnv('MONGO_URI', '');
    const stderr = vi.fn();
    const { runEstimateOpenAiTranslationCostsCli } = await loadScript();

    await expect(
      runEstimateOpenAiTranslationCostsCli({
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
    const { estimateOpenAiTranslationCostsFromEnv } = await loadScript();

    await expect(estimateOpenAiTranslationCostsFromEnv({ configs: {} })).resolves.toMatchObject({
      dryRun: true,
    });

    expect(connect).toHaveBeenCalledWith('mongodb://direct-env');
    expect(disconnect).toHaveBeenCalled();
  });
});
