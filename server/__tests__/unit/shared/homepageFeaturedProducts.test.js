import { describe, expect, it } from 'vitest';

import * as FrontendHomepageFeaturedProducts from '../../../../happy-colors-nextjs-project/src/config/homepageFeaturedProducts.js';
import * as ServerHomepageFeaturedProducts from '../../../config/homepageFeaturedProducts.js';
import * as SharedHomepageFeaturedProducts from '../../../../shared/config/homepageFeaturedProducts.js';

describe('shared homepage featured product limits', () => {
  it('keeps runtime wrappers aligned with the shared homepage featured limit', () => {
    expect(ServerHomepageFeaturedProducts.HOMEPAGE_FEATURED_PRODUCTS_LIMIT).toBe(
      SharedHomepageFeaturedProducts.HOMEPAGE_FEATURED_PRODUCTS_LIMIT
    );
    expect(FrontendHomepageFeaturedProducts.HOMEPAGE_FEATURED_PRODUCTS_LIMIT).toBe(
      SharedHomepageFeaturedProducts.HOMEPAGE_FEATURED_PRODUCTS_LIMIT
    );
  });

  it('pins the homepage featured product limit', () => {
    expect(SharedHomepageFeaturedProducts.HOMEPAGE_FEATURED_PRODUCTS_LIMIT).toBe(4);
  });
});
