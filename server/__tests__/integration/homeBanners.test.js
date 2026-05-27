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
      owner: String(owner._id),
    });
    expect(res.body).not.toHaveProperty('unexpectedField');
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
