import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { deleteImageFromGCS } from '../../helpers/gcsImageHelper.js';
import Product from '../../models/Product.js';
import { createExpressApp } from '../../server.js';
import {
  authCookie,
  buildProduct,
  createCategory,
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
    const owner = await createUser();
    const category = await createCategory();

    const res = await request(app)
      .post('/products')
      .set('Cookie', authCookie(owner))
      .send(buildProduct({ owner, category, title: 'Created Product' }))
      .expect(201);

    expect(res.body).toMatchObject({
      title: 'Created Product',
      owner: String(owner._id),
    });
  });

  it('rejects product creation without authentication', async () => {
    const app = createExpressApp();
    const category = await createCategory();

    await request(app).post('/products').send(buildProduct({ category })).expect(401);
  });

  it('allows owners to edit their products', async () => {
    const app = createExpressApp();
    const owner = await createUser();
    const category = await createCategory();
    const product = await createProduct({ owner, category, title: 'Original title' });

    const editRes = await request(app)
      .put(`/products/${product._id}`)
      .set('Cookie', authCookie(owner))
      .send({ title: 'Updated title' })
      .expect(200);

    expect(editRes.body.title).toBe('Updated title');
  });

  it('allows owners to delete their products', async () => {
    const app = createExpressApp();
    const owner = await createUser();
    const category = await createCategory();
    const product = await createProduct({ owner, category });

    await request(app).delete(`/products/${product._id}`).set('Cookie', authCookie(owner)).expect(204);

    await expect(Product.findById(product._id)).resolves.toBeNull();
  });

  it('does not delete product storage assets that are still used by a home banner', async () => {
    const app = createExpressApp();
    const owner = await createUser();
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

    await expect(Product.findById(product._id)).resolves.toBeNull();
    expect(deleteImageFromGCS).not.toHaveBeenCalledWith(sharedImageUrl);
  });

  it('does not delete product storage assets that are still used by another product', async () => {
    const app = createExpressApp();
    const owner = await createUser();
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

    await expect(Product.findById(product._id)).resolves.toBeNull();
    expect(deleteImageFromGCS).not.toHaveBeenCalledWith(sharedImageUrl);
  });

  it('rejects edit and delete requests from non-owners', async () => {
    const app = createExpressApp();
    const owner = await createUser({ email: 'owner@example.com' });
    const otherUser = await createUser({ email: 'other@example.com' });
    const category = await createCategory();
    const product = await createProduct({ owner, category });
    const nonOwnerCookie = authCookie(otherUser);

    await request(app)
      .put(`/products/${product._id}`)
      .set('Cookie', nonOwnerCookie)
      .send({ title: 'Not allowed' })
      .expect(403);

    await request(app).delete(`/products/${product._id}`).set('Cookie', nonOwnerCookie).expect(403);

    await expect(Product.findById(product._id)).resolves.toBeTruthy();
  });
});
