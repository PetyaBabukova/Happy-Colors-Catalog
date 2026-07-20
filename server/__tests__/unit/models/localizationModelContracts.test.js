import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import BlogArticle from '../../../models/BlogArticle.js';
import CartoonOrder from '../../../models/CartoonOrder.js';
import Category from '../../../models/Category.js';
import HomeBanner from '../../../models/HomeBanner.js';
import NewsletterSubscriber from '../../../models/NewsletterSubscriber.js';
import Product from '../../../models/Product.js';

function id() {
  return new mongoose.Types.ObjectId();
}

function translation(overrides = {}) {
  return {
    sourceRevision: 1,
    method: 'manual',
    ...overrides,
  };
}

function expectValid(document) {
  expect(document.validateSync()).toBeUndefined();
}

function expectInvalidPath(document, path) {
  const validationError = document.validateSync();

  expect(validationError?.errors[path]).toBeDefined();
}

function buildProduct(overrides = {}) {
  return new Product({
    title: 'BG product',
    description: 'BG product description',
    price: 20,
    category: id(),
    owner: id(),
    ...overrides,
  });
}

function buildCategory(overrides = {}) {
  return new Category({
    name: 'BG category',
    slug: 'bg-category',
    ...overrides,
  });
}

function blogTranslation(overrides = {}) {
  return translation({
    title: 'EN article',
    contentHtml: '<p>Article body</p>',
    contentText: 'Article body',
    excerpt: 'Article excerpt',
    heroImageAlt: 'Hero image',
    ...overrides,
  });
}

function buildBlogArticle(overrides = {}) {
  return new BlogArticle({
    title: 'BG article',
    contentHtml: '<p>Article body</p>',
    heroImageUrl: 'https://example.com/hero.jpg',
    thumbnailImageUrl: 'https://example.com/thumb.jpg',
    heroImageAlt: 'Hero image',
    owner: id(),
    ...overrides,
  });
}

function bannerTranslation(overrides = {}) {
  return translation({
    title: 'EN banner',
    description: 'Banner description',
    ctaLabel: 'Open catalog',
    ...overrides,
  });
}

function buildHomeBanner(overrides = {}) {
  return new HomeBanner({
    title: 'BG banner',
    description: 'Banner description',
    ctaLabel: 'Catalog',
    ctaHref: '/products',
    imageUrl: 'https://example.com/banner.jpg',
    owner: id(),
    ...overrides,
  });
}

function buildCartoonOrder(overrides = {}) {
  return new CartoonOrder({
    customer: {
      name: 'Customer',
      email: 'customer@example.com',
      message: 'Please make a custom toy.',
    },
    photos: [
      {
        objectName: 'cartoon-orders/reference-photos/photo.jpg',
        originalName: 'photo.jpg',
        contentType: 'image/jpeg',
        size: 1024,
        uploadSessionId: 'session-1',
      },
    ],
    consentAccepted: true,
    consentAcceptedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  });
}

describe('localization model contracts', () => {
  it('keeps product translations optional and restricts target locale keys', () => {
    const legacyProduct = buildProduct();

    expectValid(legacyProduct);
    expect(legacyProduct.sourceRevision).toBe(1);

    const translatedProduct = buildProduct({
      translations: {
        en: translation({
          title: 'EN product',
          description: 'EN product description',
        }),
      },
    });

    expectValid(translatedProduct);
    expect(translatedProduct.translations.get('en').translationRevision).toBe(1);

    const invalidProduct = buildProduct({
      translations: {
        fr: translation({
          title: 'FR product',
          description: 'FR product description',
        }),
      },
    });

    expectInvalidPath(invalidProduct, 'translations');
  });

  it('adds canonical category slug review fields and category translation contracts', () => {
    const category = buildCategory({
      translations: {
        en: translation({ name: 'EN category' }),
      },
    });

    expectValid(category);
    expect(category.canonicalSlug).toBe('');
    expect(category.canonicalSlugReviewed).toBe(false);
    expect(category.slugAliases).toEqual([]);

    const invalidCategory = buildCategory({
      translations: {
        bg: translation({ name: 'BG should not be a target translation' }),
      },
    });

    expectInvalidPath(invalidCategory, 'translations');
  });

  it('supports approved and draft translations for approval-gated content', () => {
    const article = buildBlogArticle({
      translations: {
        en: blogTranslation(),
      },
      translationDrafts: {
        en: blogTranslation({ title: 'Draft EN article' }),
      },
    });
    const banner = buildHomeBanner({
      translations: {
        en: bannerTranslation(),
      },
      translationDrafts: {
        en: bannerTranslation({ title: 'Draft EN banner' }),
      },
    });

    expectValid(article);
    expect(article.translationDrafts.get('en').draftRevision).toBe(1);
    expectValid(banner);
    expect(banner.translationDrafts.get('en').draftRevision).toBe(1);

    const invalidArticle = buildBlogArticle({
      translationDrafts: {
        bg: blogTranslation(),
      },
    });
    const invalidBanner = buildHomeBanner({
      translationDrafts: {
        fr: bannerTranslation(),
      },
    });

    expectInvalidPath(invalidArticle, 'translationDrafts');
    expectInvalidPath(invalidBanner, 'translationDrafts');
  });

  it('captures preferred subscriber locale and pending language preference state', () => {
    const subscriber = new NewsletterSubscriber({
      email: 'subscriber@example.com',
      consentGivenAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    expectValid(subscriber);
    expect(subscriber.preferredLocale).toBe('bg');
    expect(subscriber.pendingPreferredLocale).toBeNull();
    expect(subscriber.pendingLocaleRequestedAt).toBeNull();
    expect(subscriber.localeChangeRequestVersion).toBe(1);
    expect(subscriber.preferenceTokenVersion).toBe(1);
    expect(subscriber.consecutiveUndeliveredCount).toBe(0);

    subscriber.preferredLocale = 'fr';

    expectInvalidPath(subscriber, 'preferredLocale');
  });

  it('captures customer locale for cartoon orders without requiring new input fields', () => {
    const order = buildCartoonOrder();

    expectValid(order);
    expect(order.customerLocale).toBe('bg');

    order.customerLocale = 'en';
    expectValid(order);

    order.customerLocale = 'fr';
    expectInvalidPath(order, 'customerLocale');
  });
});
