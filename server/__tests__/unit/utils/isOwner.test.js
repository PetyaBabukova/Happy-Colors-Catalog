import { describe, expect, it } from 'vitest';
import { isOwner } from '../../../utils/isOwner.js';

describe('isOwner', () => {
  it('matches owner and user ids using string conversion', () => {
    const objectIdLike = {
      toString: () => 'user-1',
    };

    expect(isOwner({ owner: objectIdLike }, 'user-1')).toBe(true);
  });

  it('returns false for missing product or user id', () => {
    expect(isOwner(null, 'user-1')).toBe(false);
    expect(isOwner({ owner: 'user-1' }, '')).toBe(false);
  });

  it('returns false for a different owner', () => {
    expect(isOwner({ owner: 'user-1' }, 'user-2')).toBe(false);
  });
});
