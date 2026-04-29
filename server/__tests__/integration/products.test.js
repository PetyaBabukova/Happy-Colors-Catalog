import request from 'supertest';
import { describe, expect, it } from 'vitest';
import Product from '../../models/Product.js';
import { createExpressApp } from '../../server.js';
import { authCookie, buildProduct, createCategory, createProduct, createUser } from './factories.js';

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

  it('allows owners to edit and delete their products', async () => {
    const app = createExpressApp();
    const owner = await createUser();
    const category = await createCategory();
    const product = await createProduct({ owner, category, title: 'Original title' });
    const cookie = authCookie(owner);

    const editRes = await request(app)
      .put(`/products/${product._id}`)
      .set('Cookie', cookie)
      .send({ title: 'Updated title' })
      .expect(200);

    expect(editRes.body.title).toBe('Updated title');

    await request(app).delete(`/products/${product._id}`).set('Cookie', cookie).expect(204);

    await expect(Product.findById(product._id)).resolves.toBeNull();
  });
});
