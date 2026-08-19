import { describe, expect, it } from 'vitest';
import { stringifyJsonLd } from '../../../src/utils/jsonLd.js';

describe('jsonLd utilities', () => {
  it('serializes JSON-LD while escaping script-breaking angle brackets', () => {
    expect(stringifyJsonLd({ value: '<script>alert(1)</script>' })).toBe(
      '{"value":"\\u003cscript>alert(1)\\u003c/script>"}'
    );
  });
});
