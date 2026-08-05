import { describe, expect, it } from 'vitest';
import { publicPageContentModules } from '@/content/publicPages';

function collectShape(value) {
  if (Array.isArray(value)) {
    return {
      type: 'array',
      length: value.length,
      items: value.map(collectShape),
    };
  }

  if (value && typeof value === 'object') {
    return {
      type: 'object',
      keys: Object.keys(value).sort(),
      entries: Object.fromEntries(
        Object.keys(value)
          .sort()
          .map((key) => [key, collectShape(value[key])])
      ),
    };
  }

  return { type: typeof value };
}

describe('public page content modules', () => {
  it('keeps paired Bulgarian and English content structurally aligned', () => {
    for (const [moduleName, content] of Object.entries(publicPageContentModules)) {
      expect(content, moduleName).toHaveProperty('bg');
      expect(content, moduleName).toHaveProperty('en');
      expect(collectShape(content.en), moduleName).toEqual(collectShape(content.bg));
    }
  });
});
