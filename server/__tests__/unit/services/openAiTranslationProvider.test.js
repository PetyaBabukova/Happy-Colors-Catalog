import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { translateWithOpenAI } from '../../../services/translation/providers/openAiTranslationProvider.js';

describe('openAiTranslationProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_TRANSLATION_MODEL;
    delete process.env.OPENAI_TRANSLATION_TIMEOUT_MS;
  });

  it('fails closed when the API key is missing', async () => {
    await expect(
      translateWithOpenAI({
        entityType: 'product',
        sourceFields: { title: 'Лъвче' },
        fields: ['title'],
      })
    ).rejects.toMatchObject({
      message: 'OPENAI_API_KEY is not configured.',
      statusCode: 501,
    });
  });

  it('requests a strict structured JSON translation response without storing response state', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.OPENAI_TRANSLATION_MODEL = 'gpt-5-custom';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          model: 'gpt-5-custom',
          output_text: JSON.stringify({ title: 'Little Lion' }),
        }),
      })
    );

    await expect(
      translateWithOpenAI({
        entityType: 'product',
        sourceFields: { title: 'Лъвче' },
        fields: ['title'],
      })
    ).resolves.toEqual({
      provider: 'openai',
      providerModel: 'gpt-5-custom',
      fields: { title: 'Little Lion' },
    });

    const [, requestOptions] = fetch.mock.calls[0];
    const body = JSON.parse(requestOptions.body);

    expect(body).toMatchObject({
      model: 'gpt-5-custom',
      store: false,
      text: {
        format: {
          type: 'json_schema',
          strict: true,
          schema: {
            additionalProperties: false,
            required: ['title'],
          },
        },
      },
    });
    expect(body.input[1].content).toContain('"sourceLocale":"bg"');
  });

  it('rejects malformed provider JSON', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ output_text: 'not json' }),
      })
    );

    await expect(
      translateWithOpenAI({
        entityType: 'category',
        sourceFields: { name: 'Играчки' },
        fields: ['name'],
      })
    ).rejects.toMatchObject({
      message: 'OpenAI returned invalid translation JSON.',
      statusCode: 502,
    });
  });

  it('times out slow provider requests', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.OPENAI_TRANSLATION_TIMEOUT_MS = '10';
    vi.stubGlobal(
      'fetch',
      vi.fn((_url, options) => new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      }))
    );

    const promise = translateWithOpenAI({
      entityType: 'homeBanner',
      sourceFields: { title: 'Банер' },
      fields: ['title'],
    });
    const expectation = expect(promise).rejects.toMatchObject({
      message: 'OpenAI translation request timed out.',
      statusCode: 504,
    });

    await vi.advanceTimersByTimeAsync(10);

    await expectation;
  });
});
