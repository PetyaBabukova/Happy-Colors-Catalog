import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { deleteImageFromGCS } from '../../helpers/gcsImageHelper.js';
import { sendEmail } from '../../helpers/sendEmail.js';
import Product from '../../models/Product.js';
import { createExpressApp } from '../../server.js';
import {
  authCookie,
  buildProduct,
  createActiveArtist,
  createBlogArticle,
  createCategory,
  createFullAdmin,
  createHomeBanner,
  createProduct,
  createUser,
} from './factories.js';

describe('products integration', () => {
  it('lists products and filters by category name', async () => {
    const app = createExpressApp();
    const owner = await createUser();
    const candles = await createCategory({ name: 'Candles', slug: 'candles' });
    const paintings = await createCategory({ name: 'Paintings', slug: 'paintings' });
    await createProduct({ owner, category: candles, title: 'Red Candle' });
    await createProduct({ owner, category: paintings, title: 'Blue Painting' });

    const allRes = await request(app).get('/products').expect(200);
    const filteredRes = await request(app).get('/products').query({ category: 'Candles' }).expect(200);

    expect(allRes.body).toHaveLength(2);
    expect(filteredRes.body).toHaveLength(1);
    expect(filteredRes.body[0]).toMatchObject({ title: 'Red Candle' });
  });

  it('creates a product for an authenticated owner', async () => {
    const app = createExpressApp();
    const owner = await createActiveArtist();
    const admin = await createFullAdmin({ email: 'review-copy@example.com' });
    const category = await createCategory();

    const res = await request(app)
      .post('/products')
      .set('Cookie', authCookie(owner))
      .send(buildProduct({ owner, category, title: 'Created Product' }))
      .expect(201);

    expect(res.body).toMatchObject({
      title: 'Created Product',
      owner: String(owner._id),
      publicationStatus: 'pending_review',
    });
    expect(res.body.createdAt).toBeTruthy();
    expect(res.body.updatedAt).toBeTruthy();
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: [admin.email],
        subject: expect.stringContaining('Product pending approval'),
        text: expect.stringContaining(`/users/admin?reviewProduct=${res.body._id}`),
      })
    );
  });

  it('rejects product creation for customers', async () => {
    const app = createExpressApp();
    const customer = await createUser();
    const category = await createCategory();

    await request(app)
      .post('/products')
      .set('Cookie', authCookie(customer))
      .send(buildProduct({ category }))
      .expect(403);
  });

  it('does not expose non-published products publicly', async () => {
    const app = createExpressApp();
    const owner = await createActiveArtist();
    const category = await createCategory();
    const draft = await createProduct({
      owner,
      category,
      title: 'Hidden draft',
      publicationStatus: 'draft',
      isHomepageFeatured: true,
    });
    await createProduct({ owner, category, title: 'Visible published' });

    const listRes = await request(app).get('/products').expect(200);
    const featuredRes = await request(app).get('/products/homepage-featured').expect(200);

    expect(listRes.body.map((product) => product.title)).toEqual(['Visible published']);
    expect(featuredRes.body).toEqual([]);
    await request(app).get(`/products/${draft._id}`).expect(404);
  });

  it('keeps legacy products without publicationStatus public during migration', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const category = await createCategory();
    const legacyProduct = await createProduct({ owner, category, title: 'Legacy public' });
    await Product.collection.updateOne(
      { _id: legacyProduct._id },
      { $unset: { publicationStatus: '' } }
    );

    const listRes = await request(app).get('/products').expect(200);
    const detailRes = await request(app).get(`/products/${legacyProduct._id}`).expect(200);

    expect(listRes.body.map((product) => product._id)).toContain(String(legacyProduct._id));
    expect(detailRes.body).toMatchObject({ _id: String(legacyProduct._id), title: 'Legacy public' });
  });

  it('rejects product creation without authentication', async () => {
    const app = createExpressApp();
    const category = await createCategory();

    await request(app).post('/products').send(buildProduct({ category })).expect(401);
  });

  it('returns homepage featured products before the productId route catches the path', async () => {
    const app = createExpressApp();

    const res = await request(app).get('/products/homepage-featured').expect(200);

    expect(res.body).toEqual([]);
  });

  it('lists selected available homepage featured products in saved order', async () => {
    const app = createExpressApp();
    const owner = await createUser();
    const category = await createCategory();
    await createProduct({
      owner,
      category,
      title: 'Hidden unavailable',
      availability: 'unavailable',
      isHomepageFeatured: true,
      homepageFeaturedOrder: 0,
    });
    const second = await createProduct({
      owner,
      category,
      title: 'Second visible',
      isHomepageFeatured: true,
      homepageFeaturedOrder: 2,
    });
    const first = await createProduct({
      owner,
      category,
      title: 'First visible',
      isHomepageFeatured: true,
      homepageFeaturedOrder: 1,
    });

    const res = await request(app).get('/products/homepage-featured').expect(200);

    expect(res.body.map((product) => product._id)).toEqual([String(first._id), String(second._id)]);
  });

  it('allows authenticated users to update homepage featured products', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin({ email: 'owner@example.com' });
    const category = await createCategory();
    const first = await createProduct({ owner, category, title: 'First pick' });
    const second = await createProduct({ owner, category, title: 'Second pick' });

    await request(app)
      .put('/products/homepage-featured')
      .send({ productIds: [String(first._id)] })
      .expect(401);

    const customer = await createUser({ email: 'customer@example.com' });

    await request(app)
      .put('/products/homepage-featured')
      .set('Cookie', authCookie(customer))
      .send({ productIds: [String(first._id)] })
      .expect(403);

    const res = await request(app)
      .put('/products/homepage-featured')
      .set('Cookie', authCookie(owner))
      .send({ productIds: [String(second._id), String(first._id)] })
      .expect(200);

    expect(res.body.map((product) => product._id)).toEqual([String(second._id), String(first._id)]);

    const updatedFirst = await Product.findById(first._id).lean();
    const updatedSecond = await Product.findById(second._id).lean();

    expect(updatedFirst).toMatchObject({ isHomepageFeatured: true, homepageFeaturedOrder: 1 });
    expect(updatedSecond).toMatchObject({ isHomepageFeatured: true, homepageFeaturedOrder: 0 });
  });

  it('allows an authenticated user to clear homepage featured products intentionally', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const category = await createCategory();
    const product = await createProduct({
      owner,
      category,
      isHomepageFeatured: true,
      homepageFeaturedOrder: 0,
    });

    const res = await request(app)
      .put('/products/homepage-featured')
      .set('Cookie', authCookie(owner))
      .send({ productIds: [] })
      .expect(200);

    expect(res.body).toEqual([]);
    await expect(Product.findById(product._id).lean()).resolves.toMatchObject({
      isHomepageFeatured: false,
      homepageFeaturedOrder: 0,
    });
  });

  it('rejects unavailable products in homepage featured updates', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const category = await createCategory();
    const product = await createProduct({
      owner,
      category,
      availability: 'unavailable',
    });

    await request(app)
      .put('/products/homepage-featured')
      .set('Cookie', authCookie(owner))
      .send({ productIds: [String(product._id)] })
      .expect(400);
  });

  it('allows owners to edit their products', async () => {
    const app = createExpressApp();
    const owner = await createActiveArtist();
    const category = await createCategory();
    const product = await createProduct({
      owner,
      category,
      title: 'Original title',
      publicationStatus: 'draft',
    });

    const editRes = await request(app)
      .put(`/products/${product._id}`)
      .set('Cookie', authCookie(owner))
      .send({ title: 'Updated title' })
      .expect(200);

    expect(editRes.body.title).toBe('Updated title');
  });

  it('allows owners to delete their products', async () => {
    const app = createExpressApp();
    const owner = await createActiveArtist();
    const category = await createCategory();
    const imageUrl = 'https://storage.googleapis.com/test-bucket/products/images/delete-me.webp';
    const videoUrl = 'https://storage.googleapis.com/test-bucket/products/videos/delete-me.mp4';
    const posterUrl = 'https://storage.googleapis.com/test-bucket/products/posters/delete-me.webp';
    const product = await createProduct({
      owner,
      category,
      publicationStatus: 'published',
      imageUrl,
      imageUrls: [imageUrl],
      videos: [
        {
          url: videoUrl,
          posterUrl,
          mimeType: 'video/mp4',
          durationSeconds: 8,
          uploadDate: new Date(),
        },
      ],
    });

    await request(app).delete(`/products/${product._id}`).set('Cookie', authCookie(owner)).expect(204);

    await expect(Product.findById(product._id).lean()).resolves.toBeNull();
    expect(deleteImageFromGCS).toHaveBeenCalledWith(imageUrl, { throwOnError: true });
    expect(deleteImageFromGCS).toHaveBeenCalledWith(videoUrl, { throwOnError: true });
    expect(deleteImageFromGCS).toHaveBeenCalledWith(posterUrl, { throwOnError: true });
    await request(app).get(`/products/${product._id}`).expect(404);

    const mineRes = await request(app)
      .get('/products/mine')
      .set('Cookie', authCookie(owner))
      .expect(200);

    expect(mineRes.body.map((item) => item._id)).not.toContain(String(product._id));
  });

  it('keeps the product when storage cleanup fails during delete', async () => {
    const app = createExpressApp();
    const owner = await createActiveArtist();
    const category = await createCategory();
    const imageUrl = 'https://storage.googleapis.com/test-bucket/products/images/delete-fails.webp';
    const product = await createProduct({
      owner,
      category,
      imageUrl,
      imageUrls: [imageUrl],
    });
    deleteImageFromGCS.mockRejectedValueOnce(new Error('storage outage'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await request(app).delete(`/products/${product._id}`).set('Cookie', authCookie(owner)).expect(500);

    await expect(Product.findById(product._id).lean()).resolves.toMatchObject({
      _id: product._id,
      imageUrl,
    });
  });

  it('removes deleted featured products from the homepage featured list', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const category = await createCategory();
    const deletedProduct = await createProduct({
      owner,
      category,
      title: 'Deleted featured',
      isHomepageFeatured: true,
      homepageFeaturedOrder: 0,
    });
    const keptProduct = await createProduct({
      owner,
      category,
      title: 'Kept featured',
      isHomepageFeatured: true,
      homepageFeaturedOrder: 1,
    });

    await request(app).delete(`/products/${deletedProduct._id}`).set('Cookie', authCookie(owner)).expect(204);

    const res = await request(app).get('/products/homepage-featured').expect(200);

    expect(res.body.map((product) => product._id)).toEqual([String(keptProduct._id)]);
  });

  it('does not delete product storage assets that are still used by a home banner', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const category = await createCategory();
    const sharedImageUrl = 'https://storage.googleapis.com/test-bucket/products/images/shared.webp';
    const product = await createProduct({
      owner,
      category,
      imageUrl: sharedImageUrl,
      imageUrls: [sharedImageUrl],
    });
    await createHomeBanner({ owner, imageUrl: sharedImageUrl });

    await request(app).delete(`/products/${product._id}`).set('Cookie', authCookie(owner)).expect(204);

    await expect(Product.findById(product._id).lean()).resolves.toBeNull();
    expect(deleteImageFromGCS.mock.calls.map(([assetUrl]) => assetUrl)).not.toContain(sharedImageUrl);
  });

  it('does not delete product storage assets that are still used by a home banner mobile image', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const category = await createCategory();
    const sharedImageUrl = 'https://storage.googleapis.com/test-bucket/products/images/shared-mobile-banner.webp';
    const product = await createProduct({
      owner,
      category,
      imageUrl: sharedImageUrl,
      imageUrls: [sharedImageUrl],
    });
    await createHomeBanner({ owner, mobileImageUrl: sharedImageUrl });

    await request(app).delete(`/products/${product._id}`).set('Cookie', authCookie(owner)).expect(204);

    await expect(Product.findById(product._id).lean()).resolves.toBeNull();
    expect(deleteImageFromGCS.mock.calls.map(([assetUrl]) => assetUrl)).not.toContain(sharedImageUrl);
  });

  it('does not delete product storage assets that are still used by another product', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const category = await createCategory();
    const sharedImageUrl = 'https://storage.googleapis.com/test-bucket/products/images/shared-product.webp';
    const product = await createProduct({
      owner,
      category,
      imageUrl: sharedImageUrl,
      imageUrls: [sharedImageUrl],
    });
    await createProduct({
      owner,
      category,
      title: 'Still using shared image',
      imageUrl: sharedImageUrl,
      imageUrls: [sharedImageUrl],
    });

    await request(app).delete(`/products/${product._id}`).set('Cookie', authCookie(owner)).expect(204);

    await expect(Product.findById(product._id).lean()).resolves.toBeNull();
    expect(deleteImageFromGCS.mock.calls.map(([assetUrl]) => assetUrl)).not.toContain(sharedImageUrl);
  });

  it('does not delete product storage assets that are still used by a blog article or product draft', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const category = await createCategory();
    const sharedBlogImageUrl =
      'https://storage.googleapis.com/test-bucket/products/images/shared-blog.webp';
    const sharedDraftPosterUrl =
      'https://storage.googleapis.com/test-bucket/products/posters/shared-draft.webp';
    const product = await createProduct({
      owner,
      category,
      imageUrl: sharedBlogImageUrl,
      imageUrls: [sharedBlogImageUrl, sharedDraftPosterUrl],
    });
    await createBlogArticle({
      owner,
      heroImageUrl: sharedBlogImageUrl,
      thumbnailImageUrl: 'https://storage.googleapis.com/test-bucket/blog/articles/thumbnails/shared-blog.webp',
    });
    await createProduct({
      owner,
      category,
      title: 'Draft keeps poster',
      imageUrl: 'https://storage.googleapis.com/test-bucket/products/images/other.webp',
      imageUrls: ['https://storage.googleapis.com/test-bucket/products/images/other.webp'],
      draftContent: {
        title: 'Draft content',
        description: 'Draft description',
        price: 10,
        imageUrl: '',
        imageUrls: [],
        videos: [
          {
            url: 'https://storage.googleapis.com/test-bucket/products/videos/draft.mp4',
            posterUrl: sharedDraftPosterUrl,
            mimeType: 'video/mp4',
            durationSeconds: 8,
            uploadDate: new Date(),
          },
        ],
        category: category._id,
        availability: 'available',
      },
    });

    await request(app).delete(`/products/${product._id}`).set('Cookie', authCookie(owner)).expect(204);

    await expect(Product.findById(product._id).lean()).resolves.toBeNull();
    expect(deleteImageFromGCS.mock.calls.map(([assetUrl]) => assetUrl)).not.toContain(sharedBlogImageUrl);
    expect(deleteImageFromGCS.mock.calls.map(([assetUrl]) => assetUrl)).not.toContain(sharedDraftPosterUrl);
  });

  it('rejects edit and delete requests from non-owners', async () => {
    const app = createExpressApp();
    const owner = await createActiveArtist({ email: 'owner@example.com' });
    const otherUser = await createActiveArtist({ email: 'other@example.com' });
    const category = await createCategory();
    const product = await createProduct({ owner, category, publicationStatus: 'draft' });
    const nonOwnerCookie = authCookie(otherUser);

    await request(app)
      .put(`/products/${product._id}`)
      .set('Cookie', nonOwnerCookie)
      .send({ title: 'Not allowed' })
      .expect(403);

    await request(app).delete(`/products/${product._id}`).set('Cookie', nonOwnerCookie).expect(403);

    await expect(Product.findById(product._id)).resolves.toBeTruthy();
  });

  it('allows full admins to manage products owned by other users', async () => {
    const app = createExpressApp();
    const artist = await createActiveArtist({ email: 'artist@example.com' });
    const admin = await createFullAdmin({ email: 'admin@example.com' });
    const category = await createCategory();
    const product = await createProduct({ owner: artist, category, publicationStatus: 'published' });

    await request(app)
      .put(`/products/${product._id}`)
      .set('Cookie', authCookie(admin))
      .send({ title: 'Admin edited' })
      .expect(200);

    await request(app).delete(`/products/${product._id}`).set('Cookie', authCookie(admin)).expect(204);
    await expect(Product.findById(product._id).lean()).resolves.toBeNull();
  });

  it('supports artist review submission and full-admin approval', async () => {
    const app = createExpressApp();
    const artist = await createActiveArtist({ email: 'review-artist@example.com' });
    const admin = await createFullAdmin({ email: 'review-admin@example.com' });
    const category = await createCategory();
    const product = await createProduct({
      owner: artist,
      category,
      publicationStatus: 'draft',
      title: 'Review me',
    });

    const submitRes = await request(app)
      .patch(`/products/${product._id}/submit-review`)
      .set('Cookie', authCookie(artist))
      .expect(200);

    expect(submitRes.body.publicationStatus).toBe('pending_review');

    const queueRes = await request(app)
      .get('/products/review-queue')
      .set('Cookie', authCookie(admin))
      .expect(200);

    expect(queueRes.body.map((item) => item._id)).toContain(String(product._id));

    const approveRes = await request(app)
      .patch(`/products/${product._id}/approve`)
      .set('Cookie', authCookie(admin))
      .expect(200);

    expect(approveRes.body.publicationStatus).toBe('published');
    await request(app).get(`/products/${product._id}`).expect(200);
  });

  it('lets artists revise pending products and keeps the latest revision pending review', async () => {
    const app = createExpressApp();
    const artist = await createActiveArtist({ email: 'blocked-artist@example.com' });
    const admin = await createFullAdmin({ email: 'reject-admin@example.com' });
    const category = await createCategory();
    const product = await createProduct({ owner: artist, category, publicationStatus: 'pending_review' });

    const pendingEditRes = await request(app)
      .put(`/products/${product._id}`)
      .set('Cookie', authCookie(artist))
      .send({ title: 'Artist revised while pending' })
      .expect(200);

    expect(pendingEditRes.body).toMatchObject({
      title: 'Artist revised while pending',
      publicationStatus: 'pending_review',
    });

    const rejectRes = await request(app)
      .patch(`/products/${product._id}/reject`)
      .set('Cookie', authCookie(admin))
      .send({ reviewNote: 'Please add one clearer photo.' })
      .expect(200);

    expect(rejectRes.body).toMatchObject({
      publicationStatus: 'rejected',
      reviewNote: 'Please add one clearer photo.',
    });

    const editRes = await request(app)
      .put(`/products/${product._id}`)
      .set('Cookie', authCookie(artist))
      .send({ title: 'Artist revised' })
      .expect(200);

    expect(editRes.body).toMatchObject({
      title: 'Artist revised',
      publicationStatus: 'pending_review',
      reviewNote: '',
    });
  });

  it('stores artist edits to published products as pending draft content until admin approval', async () => {
    const app = createExpressApp();
    const artist = await createActiveArtist({ email: 'published-artist@example.com' });
    const admin = await createFullAdmin({ email: 'published-review-admin@example.com' });
    const category = await createCategory();
    const product = await createProduct({
      owner: artist,
      category,
      publicationStatus: 'published',
      title: 'Approved public title',
      imageUrl: 'https://storage.googleapis.com/test-bucket/products/images/public-old.webp',
      imageUrls: [
        'https://storage.googleapis.com/test-bucket/products/images/public-old.webp',
        'https://storage.googleapis.com/test-bucket/products/images/public-kept.webp',
      ],
    });

    const editRes = await request(app)
      .put(`/products/${product._id}`)
      .set('Cookie', authCookie(artist))
      .send({
        title: 'Pending artist revision',
        imageUrl: 'https://storage.googleapis.com/test-bucket/products/images/public-kept.webp',
        imageUrls: ['https://storage.googleapis.com/test-bucket/products/images/public-kept.webp'],
      })
      .expect(200);

    expect(editRes.body).toMatchObject({
      title: 'Pending artist revision',
      publicationStatus: 'published',
      reviewStatus: 'pending_review',
      imageUrls: ['https://storage.googleapis.com/test-bucket/products/images/public-kept.webp'],
    });

    const publicRes = await request(app).get(`/products/${product._id}`).expect(200);
    expect(publicRes.body).toMatchObject({
      title: 'Approved public title',
      publicationStatus: 'published',
      imageUrls: [
        'https://storage.googleapis.com/test-bucket/products/images/public-old.webp',
        'https://storage.googleapis.com/test-bucket/products/images/public-kept.webp',
      ],
    });

    const reviewQueueRes = await request(app)
      .get('/products/review-queue')
      .set('Cookie', authCookie(admin))
      .expect(200);
    expect(reviewQueueRes.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          _id: String(product._id),
          title: 'Pending artist revision',
          reviewStatus: 'pending_review',
        }),
      ])
    );

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: [admin.email],
        subject: expect.stringContaining('Product pending approval'),
        text: expect.stringContaining(`/users/admin?reviewProduct=${product._id}`),
      })
    );

    const approveRes = await request(app)
      .patch(`/products/${product._id}/approve`)
      .set('Cookie', authCookie(admin))
      .expect(200);

    expect(approveRes.body).toMatchObject({
      title: 'Pending artist revision',
      publicationStatus: 'published',
      reviewStatus: 'none',
      imageUrls: ['https://storage.googleapis.com/test-bucket/products/images/public-kept.webp'],
    });
    expect(deleteImageFromGCS).toHaveBeenCalledWith(
      'https://storage.googleapis.com/test-bucket/products/images/public-old.webp',
      { throwOnError: false }
    );
  });

  it('requires a review note when rejecting a product', async () => {
    const app = createExpressApp();
    const artist = await createActiveArtist({ email: 'empty-note-artist@example.com' });
    const admin = await createFullAdmin({ email: 'empty-note-admin@example.com' });
    const category = await createCategory();
    const product = await createProduct({ owner: artist, category, publicationStatus: 'pending_review' });

    await request(app)
      .patch(`/products/${product._id}/reject`)
      .set('Cookie', authCookie(admin))
      .send({ reviewNote: '   ' })
      .expect(400);

    await expect(Product.findById(product._id).lean()).resolves.toMatchObject({
      publicationStatus: 'pending_review',
    });
  });

  it('enforces allowed admin publication status transitions', async () => {
    const app = createExpressApp();
    const artist = await createActiveArtist({ email: 'transition-artist@example.com' });
    const admin = await createFullAdmin({ email: 'transition-admin@example.com' });
    const category = await createCategory();
    const draft = await createProduct({ owner: artist, category, publicationStatus: 'draft' });
    const published = await createProduct({ owner: artist, category, publicationStatus: 'published' });
    const pending = await createProduct({ owner: artist, category, publicationStatus: 'pending_review' });

    await request(app)
      .patch(`/products/${draft._id}/approve`)
      .set('Cookie', authCookie(admin))
      .expect(400);

    await request(app)
      .patch(`/products/${published._id}/reject`)
      .set('Cookie', authCookie(admin))
      .send({ reviewNote: 'Not from published.' })
      .expect(400);

    await request(app)
      .patch(`/products/${draft._id}/archive`)
      .set('Cookie', authCookie(admin))
      .expect(400);

    const archiveRes = await request(app)
      .patch(`/products/${pending._id}/archive`)
      .set('Cookie', authCookie(admin))
      .expect(200);

    expect(archiveRes.body.publicationStatus).toBe('archived');

    await request(app)
      .patch(`/products/${published._id}/restore`)
      .set('Cookie', authCookie(admin))
      .expect(400);

    const restoreRes = await request(app)
      .patch(`/products/${pending._id}/restore`)
      .set('Cookie', authCookie(admin))
      .expect(200);

    expect(restoreRes.body.publicationStatus).toBe('draft');
    await expect(Product.findById(draft._id).lean()).resolves.toMatchObject({ publicationStatus: 'draft' });
    await expect(Product.findById(published._id).lean()).resolves.toMatchObject({ publicationStatus: 'published' });
  });

  it('applies gallery flags for a full admin on create', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin({ email: 'gallery-admin@example.com' });
    const category = await createCategory();

    const res = await request(app)
      .post('/products')
      .set('Cookie', authCookie(admin))
      .send(buildProduct({ category, title: 'Admin cartoon', isInCatalog: false, isCartoonGallery: true }))
      .expect(201);

    expect(res.body).toMatchObject({
      title: 'Admin cartoon',
      isInCatalog: false,
      isCartoonGallery: true,
    });
  });

  it('forces catalog placement and ignores gallery flags for an artist create', async () => {
    const app = createExpressApp();
    const artist = await createActiveArtist({ email: 'gallery-artist@example.com' });
    await createFullAdmin({ email: 'gallery-artist-review@example.com' });
    const category = await createCategory();

    const res = await request(app)
      .post('/products')
      .set('Cookie', authCookie(artist))
      .send(buildProduct({ category, title: 'Artist abuse', isInCatalog: false, isCartoonGallery: true }))
      .expect(201);

    // Артист не може да сложи продукт в шаржове през payload; продуктът отива в каталога.
    expect(res.body.isCartoonGallery).toBe(false);
    expect(res.body.isInCatalog).toBe(true);

    const stored = await Product.findById(res.body._id).lean();
    expect(stored.isCartoonGallery).toBe(false);
    expect(stored.isInCatalog).toBe(true);
  });

  it('ignores artist gallery flag changes on edit', async () => {
    const app = createExpressApp();
    const artist = await createActiveArtist({ email: 'gallery-edit-artist@example.com' });
    const category = await createCategory();
    const product = await createProduct({
      owner: artist,
      category,
      title: 'Artist draft',
      publicationStatus: 'draft',
      isInCatalog: true,
      isCartoonGallery: false,
    });

    await request(app)
      .put(`/products/${product._id}`)
      .set('Cookie', authCookie(artist))
      .send({ title: 'Artist draft edited', isCartoonGallery: true, isInCatalog: false })
      .expect(200);

    const stored = await Product.findById(product._id).lean();
    expect(stored.isCartoonGallery).toBe(false);
    expect(stored.isInCatalog).toBe(true);
  });

  it('lets a full admin toggle gallery flags on edit', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin({ email: 'gallery-edit-admin@example.com' });
    const category = await createCategory();
    const product = await createProduct({
      owner: admin,
      category,
      title: 'Admin toggling',
      isInCatalog: true,
      isCartoonGallery: false,
    });

    await request(app)
      .put(`/products/${product._id}`)
      .set('Cookie', authCookie(admin))
      .send({ isInCatalog: false, isCartoonGallery: true })
      .expect(200);

    const stored = await Product.findById(product._id).lean();
    expect(stored.isInCatalog).toBe(false);
    expect(stored.isCartoonGallery).toBe(true);
  });

  it('serves only cartoon-flagged published products from the cartoon gallery endpoint', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin({ email: 'cartoon-gallery-owner@example.com' });
    const category = await createCategory();
    await createProduct({ owner, category, title: 'Catalog only', isInCatalog: true, isCartoonGallery: false });
    const cartoon = await createProduct({
      owner,
      category,
      title: 'Cartoon shown',
      isInCatalog: false,
      isCartoonGallery: true,
    });
    await createProduct({
      owner,
      category,
      title: 'Cartoon hidden draft',
      publicationStatus: 'draft',
      isCartoonGallery: true,
    });
    await createProduct({
      owner,
      category,
      title: 'Cartoon unavailable',
      availability: 'unavailable',
      isCartoonGallery: true,
    });

    const res = await request(app).get('/products/cartoon-gallery').expect(200);

    expect(res.body.map((product) => product._id)).toEqual([String(cartoon._id)]);
  });

  it('preserves gallery flags through an admin review approval', async () => {
    const app = createExpressApp();
    const artist = await createActiveArtist({ email: 'gallery-review-artist@example.com' });
    const admin = await createFullAdmin({ email: 'gallery-review-admin@example.com' });
    const category = await createCategory();
    const product = await createProduct({
      owner: artist,
      category,
      title: 'Pending cartoon',
      publicationStatus: 'pending_review',
      isInCatalog: false,
      isCartoonGallery: true,
    });

    await request(app)
      .patch(`/products/${product._id}/approve`)
      .set('Cookie', authCookie(admin))
      .expect(200);

    const stored = await Product.findById(product._id).lean();
    expect(stored.publicationStatus).toBe('published');
    expect(stored.isInCatalog).toBe(false);
    expect(stored.isCartoonGallery).toBe(true);
  });

  it('shows a product flagged for both galleries in catalog and cartoon gallery', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin({ email: 'both-galleries-owner@example.com' });
    const category = await createCategory();
    const shared = await createProduct({
      owner,
      category,
      title: 'In both galleries',
      isInCatalog: true,
      isCartoonGallery: true,
    });

    const catalogRes = await request(app).get('/products').expect(200);
    const cartoonRes = await request(app).get('/products/cartoon-gallery').expect(200);

    expect(catalogRes.body.map((product) => product._id)).toContain(String(shared._id));
    expect(cartoonRes.body.map((product) => product._id)).toContain(String(shared._id));
  });
});
