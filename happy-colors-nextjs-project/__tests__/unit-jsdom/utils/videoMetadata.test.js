import { describe, expect, it } from 'vitest';
import { getVideoDurationSeconds } from '../../../src/utils/videoMetadata.js';

describe('videoMetadata', () => {
  it('rejects when no file is provided', async () => {
    await expect(getVideoDurationSeconds(null)).rejects.toThrow();
  });
});
