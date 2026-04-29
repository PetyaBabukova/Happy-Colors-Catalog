import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createExpressApp } from '../../server.js';
import { createCategory, createProduct, createUser } from './factories.js';

describe('search integration', () => {
  it('returns matching products by title and category', async () => {
    const app = createExpressApp();
    const owner = await createUser();
    const candles = await createCategory({ name: 'Candles', slug: 'candles' });
    const paintings = await createCategory({ name: 'Paintings', slug: 'paintings' });
    await createProduct({ owner, category: candles, title: 'Lavender Light' });
    await createProduct({ owner, category: paintings, title: 'Forest Painting' });

    const titleRes = await request(app).get('/search').query({ q: 'Lavender' }).expect(200);
    const categoryRes = await request(app).get('/search').query({ q: 'Paintings' }).expect(200);

    expect(titleRes.body).toHaveLength(1);
    expect(titleRes.body[0]).toMatchObject({ title: 'Lavender Light' });
    expect(categoryRes.body).toHaveLength(1);
    expect(categoryRes.body[0]).toMatchObject({ title: 'Forest Painting' });
  });

  it('returns an empty array for an empty query', async () => {
    const app = createExpressApp();

    const res = await request(app).get('/search').query({ q: '' }).expect(200);

    expect(res.body).toEqual([]);
  });
});
