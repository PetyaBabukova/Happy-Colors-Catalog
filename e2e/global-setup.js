import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { loadTestEnv } from '../scripts/loadTestEnv.js';
import { AUTH_COOKIE_NAME, getJwtSecret, signAuthToken } from '../server/middlewares/auth.js';
import mongoose from '../server/mongoose.js';
import {
  PRODUCT_PUBLICATION_STATUSES,
  PRODUCT_REVIEW_STATUSES,
} from '../server/utils/productPublication.js';

mongoose.set('bufferCommands', false);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const authDir = path.resolve(__dirname, '.auth');
const authStatePath = path.resolve(authDir, 'owner.json');
const ownerEmail = 'owner.e2e@example.com';
const ownerPassword = process.env.E2E_OWNER_PASSWORD || 'E2ePass123!';
const categorySlug = 'e2e-smoke';
const productTitle = 'E2E Smoke Product';
const checkoutCustomerEmail = 'checkout.e2e@example.com';
const allowNonTestDbValue = 'yes-i-know-this-can-delete-data';
const ownerId = new mongoose.Types.ObjectId('660000000000000000000001');
const categoryId = new mongoose.Types.ObjectId('660000000000000000000002');
const productId = new mongoose.Types.ObjectId('660000000000000000000003');

function assertTestDatabase(mongoUri) {
  if (!mongoUri) {
    throw new Error('MONGO_URI is required for Playwright tests. Create .env.test from .env.test.example.');
  }

  if (process.env.E2E_ALLOW_NON_TEST_DB === allowNonTestDbValue) {
    console.warn('E2E test database name guard is disabled. Seed cleanup can delete existing data.');
    return;
  }

  const databaseName = new URL(mongoUri).pathname.replace(/^\/+/, '');

  if (!databaseName.toLowerCase().includes('test')) {
    throw new Error('Refusing to run e2e setup against a database whose name does not include "test".');
  }
}

function buildStorageState({ baseURL, token, expires }) {
  const { hostname } = new URL(baseURL);

  return {
    cookies: [
      {
        name: AUTH_COOKIE_NAME,
        value: token,
        domain: hostname,
        path: '/',
        expires,
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
    ],
    origins: [],
  };
}

export default async function globalSetup(config) {
  loadTestEnv();

  const mongoUri = process.env.MONGO_URI;
  const baseURL = config.projects[0].use.baseURL;

  assertTestDatabase(mongoUri);
  getJwtSecret();

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10_000 });

  const [{ default: Category }, { default: Order }, { default: Product }, { default: User }] = await Promise.all([
    import('../server/models/Category.js'),
    import('../server/models/Order.js'),
    import('../server/models/Product.js'),
    import('../server/models/User.js'),
  ]);

  try {
    await Order.deleteMany({
      'customer.email': checkoutCustomerEmail,
    });
    await Product.deleteMany({ $or: [{ _id: productId }, { title: productTitle }] });
    await Category.deleteMany({ $or: [{ _id: categoryId }, { slug: categorySlug }] });
    await User.deleteMany({ $or: [{ _id: ownerId }, { email: ownerEmail }] });

    const owner = await User.create({
      _id: ownerId,
      username: 'e2e-owner',
      email: ownerEmail,
      password: ownerPassword,
    });

    const category = await Category.create({
      _id: categoryId,
      name: 'E2E Smoke',
      slug: categorySlug,
    });

    await Product.create({
      _id: productId,
      title: productTitle,
      description: 'Seeded product for Playwright smoke tests.',
      price: 12.5,
      imageUrl: '/lion_banner.webp',
      imageUrls: ['/lion_banner.webp'],
      category: category._id,
      owner: owner._id,
      availability: 'available',
      isInCatalog: true,
      publicationStatus: PRODUCT_PUBLICATION_STATUSES.PUBLISHED,
      reviewStatus: PRODUCT_REVIEW_STATUSES.NONE,
    });

    const issuedAt = Math.floor(Date.now() / 1000);
    const expires = issuedAt + 4 * 60 * 60;
    const token = signAuthToken(
      {
        _id: owner._id.toString(),
        username: owner.username,
        email: owner.email,
        iat: issuedAt,
        exp: expires,
      }
    );

    await fs.mkdir(authDir, { recursive: true });
    await fs.writeFile(
      authStatePath,
      JSON.stringify(buildStorageState({ baseURL, token, expires }), null, 2)
    );
  } finally {
    await mongoose.disconnect();
  }
}
