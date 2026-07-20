import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { deleteImageFromGCS } from '../../helpers/gcsImageHelper.js';
import HomeBanner from '../../models/HomeBanner.js';
import { createExpressApp } from '../../server.js';
import {
  authCookie,
  buildHomeBanner,
  createCategory,
  createHomeBanner,
  createProduct,
  createFullAdmin,
} from './factories.js';

describe('home banners integration', () => {
  it('lists active banners sorted by sort order and creation date', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    await createHomeBanner({
      owner,
      title: 'Inactive',
      sortOrder: 0,
      isActive: false,
      imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/inactive.webp',
    });
    await createHomeBanner({
      owner,
      title: 'Second',
      sortOrder: 2,
      imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/second.webp',
    });
    await createHomeBanner({
      owner,
      title: 'First',
      sortOrder: 1,
      imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/first.webp',
    });

    const res = await request(app).get('/home-banners').expect(200);

    expect(res.body.map((banner) => banner.title)).toEqual(['First', 'Second']);
  });

  it('projects only translated active banners for English public requests', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const translated = await createHomeBanner({
      owner,
      title: 'Source Hero',
      description: 'Source hero description',
      ctaLabel: 'Source CTA',
      sourceRevision: 2,
      imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/source-hero.webp',
      translations: {
        en: {
          title: 'English Hero',
          description: 'English hero description',
          ctaLabel: 'English CTA',
          sourceRevision: 2,
          method: 'manual',
        },
      },
    });
    await createHomeBanner({
      owner,
      title: 'Bulgarian Only Hero',
      imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/bg-only-hero.webp',
    });
    await createHomeBanner({
      owner,
      title: 'Fresh Hero Source',
      ctaLabel: 'Fresh CTA',
      sourceRevision: 3,
      imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/stale-hero.webp',
      translations: {
        en: {
          title: 'Stale English Hero',
          ctaLabel: 'Stale CTA',
          sourceRevision: 2,
          method: 'manual',
        },
      },
    });

    const enRes = await request(app).get('/home-banners').query({ locale: 'en' }).expect(200);
    const bgRes = await request(app).get('/home-banners').expect(200);

    expect(enRes.body).toEqual([
      expect.objectContaining({
        _id: String(translated._id),
        title: 'English Hero',
        description: 'English hero description',
        ctaLabel: 'English CTA',
        contentLocale: 'en',
        translationPending: false,
      }),
    ]);
    expect(enRes.body[0]).not.toHaveProperty('translations');
    expect(enRes.body[0]).not.toHaveProperty('translationDrafts');
    expect(enRes.body[0]).not.toHaveProperty('sourceRevision');
    expect(bgRes.body.map((banner) => banner.title)).toEqual([
      'Source Hero',
      'Bulgarian Only Hero',
      'Fresh Hero Source',
    ]);
    expect(bgRes.body[0]).not.toHaveProperty('translations');
    expect(bgRes.body[0]).not.toHaveProperty('translationDrafts');
    expect(bgRes.body[0]).not.toHaveProperty('sourceRevision');
  });

  it('bumps home banner sourceRevision when source copy is edited', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const banner = await createHomeBanner({
      owner,
      title: 'Original Hero',
      description: 'Original description',
      ctaLabel: 'Original CTA',
      sourceRevision: 1,
      imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/original-hero.webp',
    });

    const res = await request(app)
      .put(`/home-banners/${banner._id}`)
      .set('Cookie', authCookie(owner))
      .send({ title: 'Updated Hero' })
      .expect(200);

    expect(res.body).toMatchObject({
      title: 'Updated Hero',
      sourceRevision: 2,
    });
  });

  it('rejects unsupported public home banner locales', async () => {
    const app = createExpressApp();

    await request(app).get('/home-banners').query({ locale: 'fr' }).expect(400);
  });

  it('lists home banners by default while preserving legacy banners without placement', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const legacyBanner = await createHomeBanner({
      owner,
      title: 'Legacy home banner',
      sortOrder: 1,
      imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/legacy.webp',
    });
    await HomeBanner.collection.updateOne(
      { _id: legacyBanner._id },
      { $unset: { placement: '' } }
    );
    await createHomeBanner({
      owner,
      title: 'Placed home banner',
      sortOrder: 2,
      placement: 'home',
      imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/placed-home.webp',
    });
    await createHomeBanner({
      owner,
      title: 'Cartoon banner',
      sortOrder: 0,
      placement: 'cartoons',
      imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/cartoons.webp',
    });

    const res = await request(app).get('/home-banners').expect(200);

    expect(res.body.map((banner) => banner.title)).toEqual([
      'Legacy home banner',
      'Placed home banner',
    ]);
    expect(res.body.map((banner) => banner.placement)).toEqual(['home', 'home']);
  });

  it('lists legacy home banners with null or blank placement values', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const nullPlacementBanner = await createHomeBanner({
      owner,
      title: 'Legacy null placement banner',
      sortOrder: 1,
      imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/legacy-null.webp',
    });
    const blankPlacementBanner = await createHomeBanner({
      owner,
      title: 'Legacy blank placement banner',
      sortOrder: 2,
      imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/legacy-blank.webp',
    });
    await HomeBanner.collection.updateOne(
      { _id: nullPlacementBanner._id },
      { $set: { placement: null } }
    );
    await HomeBanner.collection.updateOne(
      { _id: blankPlacementBanner._id },
      { $set: { placement: '' } }
    );

    const res = await request(app).get('/home-banners').expect(200);

    expect(res.body.map((banner) => banner.title)).toEqual([
      'Legacy null placement banner',
      'Legacy blank placement banner',
    ]);
    expect(res.body.map((banner) => banner.placement)).toEqual(['home', 'home']);
  });

  it('lists home banners explicitly while preserving legacy banners without placement', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const legacyBanner = await createHomeBanner({
      owner,
      title: 'Legacy explicit home banner',
      imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/legacy-explicit.webp',
    });
    await HomeBanner.collection.updateOne(
      { _id: legacyBanner._id },
      { $unset: { placement: '' } }
    );
    await createHomeBanner({
      owner,
      title: 'Cartoon banner',
      placement: 'cartoons',
      imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/explicit-cartoon.webp',
    });

    const res = await request(app).get('/home-banners?placement=home').expect(200);

    expect(res.body.map((banner) => banner.title)).toEqual(['Legacy explicit home banner']);
    expect(res.body[0].placement).toBe('home');
  });

  it('lists only cartoon banners when placement is cartoons', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const legacyBanner = await createHomeBanner({
      owner,
      title: 'Legacy banner',
      imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/legacy-cartoon-query.webp',
    });
    await HomeBanner.collection.updateOne(
      { _id: legacyBanner._id },
      { $unset: { placement: '' } }
    );
    await createHomeBanner({
      owner,
      title: 'Home banner',
      placement: 'home',
      imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/home-only.webp',
    });
    await createHomeBanner({
      owner,
      title: 'Inactive cartoon banner',
      placement: 'cartoons',
      isActive: false,
      imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/inactive-cartoon.webp',
    });
    await createHomeBanner({
      owner,
      title: 'Cartoon banner',
      placement: 'cartoons',
      imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/cartoon-only.webp',
    });

    const res = await request(app).get('/home-banners?placement=cartoons').expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      title: 'Cartoon banner',
      placement: 'cartoons',
    });
  });

  it('rejects invalid banner placement filters', async () => {
    const app = createExpressApp();

    const res = await request(app).get('/home-banners?placement=products').expect(400);

    expect(res.body.message).toBe('Invalid banner placement.');
  });

  it('rejects empty or object-shaped banner placement filters', async () => {
    const app = createExpressApp();

    await request(app).get('/home-banners?placement=').expect(400);
    await request(app).get('/home-banners?placement[$ne]=cartoons').expect(400);
  });

  it('normalizes legacy placement on single banner reads', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const banner = await createHomeBanner({
      owner,
      title: 'Legacy read banner',
      imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/legacy-read.webp',
    });
    await HomeBanner.collection.updateOne(
      { _id: banner._id },
      { $unset: { placement: '' } }
    );

    const res = await request(app)
      .get(`/home-banners/${banner._id}`)
      .set('Cookie', authCookie(owner))
      .expect(200);

    expect(res.body).toMatchObject({
      title: 'Legacy read banner',
      placement: 'home',
    });
  });

  it('requires authentication for single banner reads and mutations', async () => {
    const app = createExpressApp();
    const banner = await createHomeBanner();

    await request(app).get(`/home-banners/${banner._id}`).expect(401);
    await request(app).post('/home-banners').send(buildHomeBanner()).expect(401);
    await request(app).put(`/home-banners/${banner._id}`).send({ title: 'Nope' }).expect(401);
    await request(app).delete(`/home-banners/${banner._id}`).expect(401);
  });

  it('returns 404 for invalid banner id formats', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const cookie = authCookie(owner);

    await request(app).get('/home-banners/not-a-valid-id').set('Cookie', cookie).expect(404);
    await request(app)
      .put('/home-banners/not-a-valid-id')
      .set('Cookie', cookie)
      .send({ title: 'Nope' })
      .expect(404);
    await request(app).delete('/home-banners/not-a-valid-id').set('Cookie', cookie).expect(404);
  });

  it('creates a banner for an authenticated trusted operator', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const payload = buildHomeBanner({ owner, title: 'Animals banner' });
    payload.owner = 'body-owner-is-ignored';

    const res = await request(app)
      .post('/home-banners')
      .set('Cookie', authCookie(owner))
      .send(payload)
      .expect(201);

    expect(res.body).toMatchObject({
      title: 'Animals banner',
      ctaHref: '/search?q=животинки',
      mobileImageUrl: '',
      owner: String(owner._id),
    });
    expect(res.body).not.toHaveProperty('unexpectedField');
  });

  it('keeps home banner required fields strict by default', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();

    const res = await request(app)
      .post('/home-banners')
      .set('Cookie', authCookie(owner))
      .send({
        imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/missing-home-fields.webp',
      })
      .expect(400);

    expect(res.body.message).toBe('Title is required.');
  });

  it('creates image-only cartoon banners and forces active behavior', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();

    const res = await request(app)
      .post('/home-banners')
      .set('Cookie', authCookie(owner))
      .send({
        placement: 'cartoons',
        imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/cartoons-image-only.webp',
        isActive: false,
        unexpectedField: 'ignored',
      })
      .expect(201);

    expect(res.body).toMatchObject({
      placement: 'cartoons',
      title: '',
      ctaLabel: '',
      ctaHref: '',
      isActive: true,
      owner: String(owner._id),
    });
    expect(res.body).not.toHaveProperty('unexpectedField');
  });

  it('rejects explicit empty placement values on create', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();

    await request(app)
      .post('/home-banners')
      .set('Cookie', authCookie(owner))
      .send({
        placement: '',
        title: 'Empty placement',
        ctaLabel: 'Open',
        ctaHref: '/products',
        imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/empty-placement.webp',
      })
      .expect(400);

    await request(app)
      .post('/home-banners')
      .set('Cookie', authCookie(owner))
      .send({
        placement: null,
        title: 'Null placement',
        ctaLabel: 'Open',
        ctaHref: '/products',
        imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/null-placement.webp',
      })
      .expect(400);
  });

  it('rejects unsafe optional CTA hrefs for cartoon banners', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();

    const res = await request(app)
      .post('/home-banners')
      .set('Cookie', authCookie(owner))
      .send({
        placement: 'cartoons',
        imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/cartoon-unsafe-cta.webp',
        ctaHref: 'javascript:alert(1)',
      })
      .expect(400);

    expect(res.body.message).toBe('CTA link must be an internal path.');
  });

  it('creates a banner with an optional mobile image URL', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const mobileImageUrl =
      'https://storage.googleapis.com/test-bucket/home-banners/mobile-images/animals-mobile.webp';

    const res = await request(app)
      .post('/home-banners')
      .set('Cookie', authCookie(owner))
      .send(buildHomeBanner({ owner, mobileImageUrl }))
      .expect(201);

    expect(res.body.mobileImageUrl).toBe(mobileImageUrl);
  });

  it('does not persist injected fields from create payloads', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();

    const res = await request(app)
      .post('/home-banners')
      .set('Cookie', authCookie(owner))
      .send({
        ...buildHomeBanner({ owner }),
        unexpectedField: 'nope',
        createdAt: '2000-01-01T00:00:00.000Z',
        __v: 99,
      })
      .expect(201);

    expect(res.body).not.toHaveProperty('unexpectedField');
    expect(res.body.__v).toBe(0);
    expect(new Date(res.body.createdAt).getFullYear()).not.toBe(2000);
  });

  it('rejects unsafe CTA hrefs and image URLs', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const cookie = authCookie(owner);

    await request(app)
      .post('/home-banners')
      .set('Cookie', cookie)
      .send(buildHomeBanner({ owner, ctaHref: 'https://example.com' }))
      .expect(400);

    await request(app)
      .post('/home-banners')
      .set('Cookie', cookie)
      .send(
        buildHomeBanner({
          owner,
          imageUrl: 'https://storage.googleapis.com/other-bucket/home-banners/banner.webp',
        })
      )
      .expect(400);

    await request(app)
      .post('/home-banners')
      .set('Cookie', cookie)
      .send(
        buildHomeBanner({
          owner,
          mobileImageUrl: 'javascript:alert(1)',
        })
      )
      .expect(400);
  });

  it('normalizes legacy banners without mobile image URLs in service responses', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const banner = await createHomeBanner({ owner, title: 'Legacy banner' });

    await HomeBanner.collection.updateOne(
      { _id: banner._id },
      { $unset: { mobileImageUrl: '' } }
    );

    const listRes = await request(app).get('/home-banners').expect(200);
    const readRes = await request(app)
      .get(`/home-banners/${banner._id}`)
      .set('Cookie', authCookie(owner))
      .expect(200);

    expect(listRes.body.find((item) => item._id === String(banner._id))).toMatchObject({
      mobileImageUrl: '',
    });
    expect(readRes.body.mobileImageUrl).toBe('');
  });

  it('returns a friendly validation error for overly long descriptions', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();

    const res = await request(app)
      .post('/home-banners')
      .set('Cookie', authCookie(owner))
      .send(buildHomeBanner({ owner, description: 'a'.repeat(601) }))
      .expect(400);

    expect(res.body.message).toBe('Description cannot be longer than 600 characters.');
  });

  it('allows authenticated trusted operators to read and edit any banner', async () => {
    const app = createExpressApp();
    const creator = await createFullAdmin({ email: 'creator@example.com' });
    const otherOperator = await createFullAdmin({ email: 'operator@example.com' });
    const banner = await createHomeBanner({ owner: creator, title: 'Original title' });

    const readRes = await request(app)
      .get(`/home-banners/${banner._id}`)
      .set('Cookie', authCookie(otherOperator))
      .expect(200);
    expect(readRes.body.title).toBe('Original title');

    const editRes = await request(app)
      .put(`/home-banners/${banner._id}`)
      .set('Cookie', authCookie(otherOperator))
      .send({ title: 'Updated title', isActive: false, sortOrder: 5 })
      .expect(200);

    expect(editRes.body).toMatchObject({
      title: 'Updated title',
      isActive: false,
      sortOrder: 5,
    });
    expect(deleteImageFromGCS).not.toHaveBeenCalled();
  });

  it('allows home banners to be deactivated without affecting cartoon forced-active behavior', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const banner = await createHomeBanner({
      owner,
      title: 'Deactivate home',
      imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/deactivate-home.webp',
    });

    const editRes = await request(app)
      .put(`/home-banners/${banner._id}`)
      .set('Cookie', authCookie(owner))
      .send({ isActive: false })
      .expect(200);

    expect(editRes.body).toMatchObject({
      placement: 'home',
      isActive: false,
    });

    const listRes = await request(app).get('/home-banners').expect(200);

    expect(listRes.body.map((item) => item._id)).not.toContain(String(banner._id));
  });

  it('rejects explicit empty placement values on edit', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const banner = await createHomeBanner({
      owner,
      title: 'Edit empty placement',
      imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/edit-empty-placement.webp',
    });

    const res = await request(app)
      .put(`/home-banners/${banner._id}`)
      .set('Cookie', authCookie(owner))
      .send({ placement: '' })
      .expect(400);

    expect(res.body.message).toBe('Invalid banner placement.');
  });

  it('repairs a persisted invalid placement when an explicit valid placement is submitted', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const banner = await createHomeBanner({
      owner,
      title: 'Repair invalid placement',
      imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/repair-placement.webp',
    });
    await HomeBanner.collection.updateOne(
      { _id: banner._id },
      { $set: { placement: 'products' } }
    );

    const res = await request(app)
      .put(`/home-banners/${banner._id}`)
      .set('Cookie', authCookie(owner))
      .send({ placement: 'home' })
      .expect(200);

    expect(res.body).toMatchObject({
      title: 'Repair invalid placement',
      placement: 'home',
    });
  });

  it('edits home banners without spurious required-field checks when placement is omitted', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const banner = await createHomeBanner({
      owner,
      title: 'Sort only edit',
      imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/sort-only-edit.webp',
    });

    const res = await request(app)
      .put(`/home-banners/${banner._id}`)
      .set('Cookie', authCookie(owner))
      .send({ sortOrder: 7 })
      .expect(200);

    expect(res.body).toMatchObject({
      title: 'Sort only edit',
      placement: 'home',
      sortOrder: 7,
    });
  });

  it('moves home banners to cartoons without requiring empty CTA fields in the payload', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const banner = await createHomeBanner({
      owner,
      title: 'Home to cartoon minimal',
      imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/home-to-cartoon-minimal.webp',
    });

    const res = await request(app)
      .put(`/home-banners/${banner._id}`)
      .set('Cookie', authCookie(owner))
      .send({ placement: 'cartoons', isActive: false })
      .expect(200);

    expect(res.body).toMatchObject({
      placement: 'cartoons',
      title: 'Home to cartoon minimal',
      isActive: true,
    });
  });

  it('moves home banners to cartoons and keeps them active even when inactive is submitted', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const banner = await createHomeBanner({
      owner,
      title: 'Home to cartoon',
      imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/home-to-cartoon.webp',
    });

    const res = await request(app)
      .put(`/home-banners/${banner._id}`)
      .set('Cookie', authCookie(owner))
      .send({
        placement: 'cartoons',
        title: '',
        ctaLabel: '',
        ctaHref: '',
        isActive: false,
      })
      .expect(200);

    expect(res.body).toMatchObject({
      placement: 'cartoons',
      title: '',
      ctaLabel: '',
      ctaHref: '',
      isActive: true,
    });
  });

  it('forces active behavior when editing an existing cartoon banner', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const createRes = await request(app)
      .post('/home-banners')
      .set('Cookie', authCookie(owner))
      .send({
        placement: 'cartoons',
        imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/edit-cartoon.webp',
      })
      .expect(201);

    const editRes = await request(app)
      .put(`/home-banners/${createRes.body._id}`)
      .set('Cookie', authCookie(owner))
      .send({ sortOrder: 3, isActive: false })
      .expect(200);

    expect(editRes.body).toMatchObject({
      placement: 'cartoons',
      sortOrder: 3,
      isActive: true,
    });
  });

  it('requires homepage fields when moving image-only cartoon banners to home', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const createRes = await request(app)
      .post('/home-banners')
      .set('Cookie', authCookie(owner))
      .send({
        placement: 'cartoons',
        imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/cartoon-to-home.webp',
      })
      .expect(201);

    const invalidMoveRes = await request(app)
      .put(`/home-banners/${createRes.body._id}`)
      .set('Cookie', authCookie(owner))
      .send({ placement: 'home' })
      .expect(400);

    expect(invalidMoveRes.body.message).toBe('Title is required.');

    const validMoveRes = await request(app)
      .put(`/home-banners/${createRes.body._id}`)
      .set('Cookie', authCookie(owner))
      .send({
        placement: 'home',
        title: 'Now home',
        ctaLabel: 'Open',
        ctaHref: '/products',
      })
      .expect(200);

    expect(validMoveRes.body).toMatchObject({
      placement: 'home',
      title: 'Now home',
      ctaLabel: 'Open',
      ctaHref: '/products',
    });
  });

  it('deletes the old image on edit when it is not referenced elsewhere', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const oldImageUrl = 'https://storage.googleapis.com/test-bucket/home-banners/old.webp';
    const newImageUrl = 'https://storage.googleapis.com/test-bucket/home-banners/new.webp';
    const banner = await createHomeBanner({ owner, imageUrl: oldImageUrl });

    await request(app)
      .put(`/home-banners/${banner._id}`)
      .set('Cookie', authCookie(owner))
      .send({ imageUrl: newImageUrl })
      .expect(200);

    expect(deleteImageFromGCS).toHaveBeenCalledWith(oldImageUrl, { throwOnError: false });
  });

  it('edits optional mobile images without clearing them on unrelated partial edits', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const mobileImageUrl =
      'https://storage.googleapis.com/test-bucket/home-banners/mobile-images/first.webp';
    const banner = await createHomeBanner({ owner });

    const addRes = await request(app)
      .put(`/home-banners/${banner._id}`)
      .set('Cookie', authCookie(owner))
      .send({ mobileImageUrl })
      .expect(200);

    expect(addRes.body.mobileImageUrl).toBe(mobileImageUrl);

    const partialRes = await request(app)
      .put(`/home-banners/${banner._id}`)
      .set('Cookie', authCookie(owner))
      .send({ title: 'Retitled banner' })
      .expect(200);

    expect(partialRes.body).toMatchObject({
      title: 'Retitled banner',
      mobileImageUrl,
    });
  });

  it('deletes replaced and cleared mobile images only after saving', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const oldMobileImageUrl =
      'https://storage.googleapis.com/test-bucket/home-banners/mobile-images/old.webp';
    const newMobileImageUrl =
      'https://storage.googleapis.com/test-bucket/home-banners/mobile-images/new.webp';
    const banner = await createHomeBanner({ owner, mobileImageUrl: oldMobileImageUrl });

    await request(app)
      .put(`/home-banners/${banner._id}`)
      .set('Cookie', authCookie(owner))
      .send({ mobileImageUrl: newMobileImageUrl })
      .expect(200);

    expect(deleteImageFromGCS).toHaveBeenCalledWith(oldMobileImageUrl, { throwOnError: false });

    deleteImageFromGCS.mockClear();

    await request(app)
      .put(`/home-banners/${banner._id}`)
      .set('Cookie', authCookie(owner))
      .send({ mobileImageUrl: '' })
      .expect(200);

    expect(deleteImageFromGCS).toHaveBeenCalledWith(newMobileImageUrl, { throwOnError: false });
  });

  it('does not delete a desktop image moved to the same banner mobile field', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const desktopImageUrl =
      'https://storage.googleapis.com/test-bucket/home-banners/same-banner-swap-old.webp';
    const newDesktopImageUrl =
      'https://storage.googleapis.com/test-bucket/home-banners/same-banner-swap-new.webp';
    const banner = await createHomeBanner({ owner, imageUrl: desktopImageUrl });

    await request(app)
      .put(`/home-banners/${banner._id}`)
      .set('Cookie', authCookie(owner))
      .send({
        imageUrl: newDesktopImageUrl,
        mobileImageUrl: desktopImageUrl,
      })
      .expect(200);

    expect(deleteImageFromGCS.mock.calls.map(([assetUrl]) => assetUrl)).not.toContain(
      desktopImageUrl
    );
  });

  it('does not delete an old image on edit when a product still references it', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const category = await createCategory();
    const sharedImageUrl = 'https://storage.googleapis.com/test-bucket/home-banners/shared.webp';
    const banner = await createHomeBanner({ owner, imageUrl: sharedImageUrl });
    await createProduct({
      owner,
      category,
      imageUrl: sharedImageUrl,
      imageUrls: [sharedImageUrl],
    });

    await request(app)
      .put(`/home-banners/${banner._id}`)
      .set('Cookie', authCookie(owner))
      .send({ imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/replacement.webp' })
      .expect(200);

    expect(deleteImageFromGCS.mock.calls.map(([assetUrl]) => assetUrl)).not.toContain(sharedImageUrl);
  });

  it('does not delete an old image on edit when another banner placement still references it', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const sharedImageUrl =
      'https://storage.googleapis.com/test-bucket/home-banners/edit-shared-cartoon-placement.webp';
    const banner = await createHomeBanner({ owner, imageUrl: sharedImageUrl });
    await HomeBanner.create({
      owner: owner._id,
      placement: 'cartoons',
      imageUrl: sharedImageUrl,
    });

    await request(app)
      .put(`/home-banners/${banner._id}`)
      .set('Cookie', authCookie(owner))
      .send({
        imageUrl:
          'https://storage.googleapis.com/test-bucket/home-banners/edit-shared-replacement.webp',
      })
      .expect(200);

    expect(deleteImageFromGCS.mock.calls.map(([assetUrl]) => assetUrl)).not.toContain(sharedImageUrl);
  });

  it('does not delete an old image on edit when a product video still references it', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const category = await createCategory();
    const sharedVideoUrl = 'https://storage.googleapis.com/test-bucket/home-banners/shared-video.mp4';
    const banner = await createHomeBanner({ owner, imageUrl: sharedVideoUrl });
    await createProduct({
      owner,
      category,
      videos: [
        {
          url: sharedVideoUrl,
          posterUrl: 'https://storage.googleapis.com/test-bucket/products/posters/poster.webp',
          mimeType: 'video/mp4',
          durationSeconds: 10,
        },
      ],
    });

    await request(app)
      .put(`/home-banners/${banner._id}`)
      .set('Cookie', authCookie(owner))
      .send({ imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/replacement.webp' })
      .expect(200);

    expect(deleteImageFromGCS).not.toHaveBeenCalledWith(sharedVideoUrl);
  });

  it('deletes a banner and cleans up its image when unreferenced', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const imageUrl = 'https://storage.googleapis.com/test-bucket/home-banners/delete-me.webp';
    const banner = await createHomeBanner({ owner, imageUrl });

    await request(app).delete(`/home-banners/${banner._id}`).set('Cookie', authCookie(owner)).expect(204);

    await expect(HomeBanner.findById(banner._id)).resolves.toBeNull();
    expect(deleteImageFromGCS).toHaveBeenCalledWith(imageUrl, { throwOnError: true });
  });

  it('deletes both desktop and mobile images once when a banner is deleted', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const imageUrl = 'https://storage.googleapis.com/test-bucket/home-banners/delete-desktop.webp';
    const mobileImageUrl =
      'https://storage.googleapis.com/test-bucket/home-banners/mobile-images/delete-mobile.webp';
    const banner = await createHomeBanner({ owner, imageUrl, mobileImageUrl });

    await request(app).delete(`/home-banners/${banner._id}`).set('Cookie', authCookie(owner)).expect(204);

    await expect(HomeBanner.findById(banner._id)).resolves.toBeNull();
    expect(deleteImageFromGCS).toHaveBeenCalledWith(imageUrl, { throwOnError: true });
    expect(deleteImageFromGCS).toHaveBeenCalledWith(mobileImageUrl, { throwOnError: true });
  });

  it('dedupes identical desktop and mobile URLs during delete', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const imageUrl = 'https://storage.googleapis.com/test-bucket/home-banners/delete-once.webp';
    const banner = await createHomeBanner({ owner, imageUrl, mobileImageUrl: imageUrl });

    await request(app).delete(`/home-banners/${banner._id}`).set('Cookie', authCookie(owner)).expect(204);

    expect(deleteImageFromGCS.mock.calls.filter(([assetUrl]) => assetUrl === imageUrl)).toHaveLength(1);
  });

  it('keeps the banner when storage cleanup fails during delete', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const imageUrl = 'https://storage.googleapis.com/test-bucket/home-banners/delete-fails.webp';
    const banner = await createHomeBanner({ owner, imageUrl });
    deleteImageFromGCS.mockRejectedValueOnce(new Error('storage outage'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await request(app).delete(`/home-banners/${banner._id}`).set('Cookie', authCookie(owner)).expect(500);

    await expect(HomeBanner.findById(banner._id).lean()).resolves.toMatchObject({
      _id: banner._id,
      imageUrl,
    });
  });

  it('attempts every banner asset cleanup and keeps the banner if one delete fails', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const imageUrl =
      'https://storage.googleapis.com/test-bucket/home-banners/partial-delete-desktop.webp';
    const mobileImageUrl =
      'https://storage.googleapis.com/test-bucket/home-banners/mobile-images/partial-delete-mobile.webp';
    const banner = await createHomeBanner({ owner, imageUrl, mobileImageUrl });
    deleteImageFromGCS
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('storage outage'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await request(app).delete(`/home-banners/${banner._id}`).set('Cookie', authCookie(owner)).expect(500);

    expect(deleteImageFromGCS).toHaveBeenCalledWith(imageUrl, { throwOnError: true });
    expect(deleteImageFromGCS).toHaveBeenCalledWith(mobileImageUrl, { throwOnError: true });
    await expect(HomeBanner.findById(banner._id).lean()).resolves.toMatchObject({
      _id: banner._id,
      imageUrl,
      mobileImageUrl,
    });
  });

  it('deletes a banner but keeps a shared image in storage', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const sharedImageUrl = 'https://storage.googleapis.com/test-bucket/home-banners/shared-delete.webp';
    const banner = await createHomeBanner({ owner, imageUrl: sharedImageUrl });
    await createHomeBanner({
      owner,
      title: 'Still using shared image',
      imageUrl: sharedImageUrl,
    });

    await request(app).delete(`/home-banners/${banner._id}`).set('Cookie', authCookie(owner)).expect(204);

    expect(deleteImageFromGCS.mock.calls.map(([assetUrl]) => assetUrl)).not.toContain(sharedImageUrl);
  });

  it('deletes a banner but keeps an image shared by another banner placement', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const sharedImageUrl =
      'https://storage.googleapis.com/test-bucket/home-banners/shared-cartoon-placement.webp';
    const banner = await createHomeBanner({ owner, imageUrl: sharedImageUrl });
    await HomeBanner.create({
      owner: owner._id,
      placement: 'cartoons',
      imageUrl: sharedImageUrl,
    });

    await request(app).delete(`/home-banners/${banner._id}`).set('Cookie', authCookie(owner)).expect(204);

    expect(deleteImageFromGCS.mock.calls.map(([assetUrl]) => assetUrl)).not.toContain(sharedImageUrl);
  });

  it('deletes a banner but keeps a mobile image shared by another banner', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const sharedMobileImageUrl =
      'https://storage.googleapis.com/test-bucket/home-banners/mobile-images/shared-delete.webp';
    const banner = await createHomeBanner({ owner, mobileImageUrl: sharedMobileImageUrl });
    await createHomeBanner({
      owner,
      title: 'Still using shared mobile image',
      mobileImageUrl: sharedMobileImageUrl,
    });

    await request(app).delete(`/home-banners/${banner._id}`).set('Cookie', authCookie(owner)).expect(204);

    expect(deleteImageFromGCS.mock.calls.map(([assetUrl]) => assetUrl)).not.toContain(
      sharedMobileImageUrl
    );
  });

  it('deletes a banner but keeps an image still used by a product', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const category = await createCategory();
    const sharedImageUrl = 'https://storage.googleapis.com/test-bucket/home-banners/product-shared.webp';
    const banner = await createHomeBanner({ owner, imageUrl: sharedImageUrl });
    await createProduct({
      owner,
      category,
      imageUrl: sharedImageUrl,
      imageUrls: [sharedImageUrl],
    });

    await request(app).delete(`/home-banners/${banner._id}`).set('Cookie', authCookie(owner)).expect(204);

    expect(deleteImageFromGCS.mock.calls.map(([assetUrl]) => assetUrl)).not.toContain(sharedImageUrl);
  });
});
