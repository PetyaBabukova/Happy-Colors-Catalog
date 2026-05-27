import request from 'supertest';
import { describe, expect, it } from 'vitest';
import Product from '../../models/Product.js';
import { createExpressApp } from '../../server.js';
import { authCookie, createCategory, createProduct, createFullAdmin, createUser } from './factories.js';

describe('categories integration', () => {
  it('creates and lists categories', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();

    const createRes = await request(app)
      .post('/categories')
      .set('Cookie', authCookie(owner))
      .send({ name: 'Candles' })
      .expect(201);
    const listRes = await request(app).get('/categories').expect(200);

    expect(createRes.body).toMatchObject({ name: 'Candles', slug: 'candles' });
    expect(listRes.body).toEqual([expect.objectContaining({ name: 'Candles' })]);
  });

  it('requires authentication for category management endpoints', async () => {
    const app = createExpressApp();
    const category = await createCategory({ name: 'Protected', slug: 'protected' });

    await request(app).post('/categories').send({ name: 'Candles' }).expect(401);
    await request(app).get(`/categories/${category._id}`).expect(401);
    await request(app).put(`/categories/${category._id}`).send({ name: 'Updated' }).expect(401);
    await request(app).delete(`/categories/${category._id}`).expect(401);
  });

  it('requires full admin for category management endpoints', async () => {
    const app = createExpressApp();
    const customer = await createUser();
    const category = await createCategory({ name: 'Admin only', slug: 'admin-only' });

    await request(app)
      .post('/categories')
      .set('Cookie', authCookie(customer))
      .send({ name: 'Candles' })
      .expect(403);
    await request(app).get(`/categories/${category._id}`).set('Cookie', authCookie(customer)).expect(403);
    await request(app)
      .put(`/categories/${category._id}`)
      .set('Cookie', authCookie(customer))
      .send({ name: 'Updated' })
      .expect(403);
    await request(app).delete(`/categories/${category._id}`).set('Cookie', authCookie(customer)).expect(403);
  });

  it('allows authenticated users to load and update a category', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const category = await createCategory({ name: 'Original', slug: 'original' });

    const getRes = await request(app)
      .get(`/categories/${category._id}`)
      .set('Cookie', authCookie(owner))
      .expect(200);
    const updateRes = await request(app)
      .put(`/categories/${category._id}`)
      .set('Cookie', authCookie(owner))
      .send({ name: 'Updated' })
      .expect(200);

    expect(getRes.body).toMatchObject({ name: 'Original' });
    expect(updateRes.body).toMatchObject({ name: 'Updated', slug: 'updated' });
  });

  it('returns only categories with products from /categories/visible', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const visible = await createCategory({ name: 'Visible', slug: 'visible' });
    await createCategory({ name: 'Hidden', slug: 'hidden' });
    await createProduct({ owner, category: visible });

    const res = await request(app).get('/categories/visible').expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ name: 'Visible' });
  });

  it('reassigns products when deleting a category in use', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const category = await createCategory({ name: 'Original', slug: 'original' });
    const product = await createProduct({ owner, category });

    const res = await request(app)
      .delete(`/categories/${category._id}`)
      .set('Cookie', authCookie(owner))
      .expect(200);
    const updatedProduct = await Product.findById(product._id).populate('category', 'name').lean();

    expect(res.body.reassigned).toBe(true);
    expect(String(updatedProduct.category._id)).not.toBe(String(category._id));
    expect(updatedProduct.category.name).toBeTruthy();
  });
});
