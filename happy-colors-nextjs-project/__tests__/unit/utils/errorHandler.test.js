import { describe, expect, it, vi } from 'vitest';
import {
  createResponseError,
  extractErrorMessage,
  readResponseJsonSafely,
} from '../../../src/utils/errorHandler.js';

describe('errorHandler', () => {
  it('extracts explicit error messages and falls back for unknown errors', () => {
    expect(extractErrorMessage(new Error('Boom'))).toBe('Boom');
    expect(extractErrorMessage({})).toBeTruthy();
  });

  it('reads JSON safely and returns null when parsing fails', async () => {
    await expect(readResponseJsonSafely({ json: vi.fn().mockResolvedValue({ ok: true }) })).resolves.toEqual({
      ok: true,
    });
    await expect(readResponseJsonSafely({ json: vi.fn().mockRejectedValue(new Error('bad json')) })).resolves.toBe(
      null
    );
  });

  it('creates response errors with optional response data', () => {
    const error = createResponseError('Failed', { status: 400, code: 'bad_request' });

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Failed');
    expect(error).toMatchObject({ status: 400, code: 'bad_request' });
  });
});
