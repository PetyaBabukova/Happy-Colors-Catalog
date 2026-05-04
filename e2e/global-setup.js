import crypto from 'crypto';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import mongoose from '../server/mongoose.js';

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

function assertTestDatabase(mongoUri) {
  if (!mongoUri) {
    throw new Error('MONGO_URI is required for Playwright tests. Create .env.test from .env.test.example.');
  }

  if (process.env.E2E_ALLOW_NON_TEST_DB === 'true') {
    return;
  }

  const databaseName = new URL(mongoUri).pathname.replace(/^\/+/, '');

  if (!databaseName.toLowerCase().includes('test')) {
    throw new Error('Refusing to run e2e setup against a database whose name does not include "test".');
  }
}

function signJwt(payload, secret) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const unsignedToken = `${header}.${body}`;
  const signature = crypto.createHmac('sha256', secret).update(unsignedToken).digest('base64url');

  return `${unsignedToken}.${signature}`;
}

function buildStorageState({ baseURL, token, expires }) {
  const { hostname } = new URL(baseURL);

  return {
    cookies: [
      {
        name: 'token',
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
  dotenv.config({ path: path.resolve(repoRoot, '.env.test') });

  const mongoUri = process.env.MONGO_URI;
  const jwtSecret = process.env.JWT_SECRET;
  const baseURL = config.projects[0].use.baseURL;

  assertTestDatabase(mongoUri);

  if (!jwtSecret) {
    throw new Error('JWT_SECRET is required for Playwright tests.');
  }

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10_000 });

  const [{ default: Category }, { default: Product }, { default: User }] = await Promise.all([
    import('../server/models/Category.js'),
    import('../server/models/Product.js'),
    import('../server/models/User.js'),
  ]);

  try {
    await Product.deleteMany({ title: productTitle });
    await Category.deleteMany({ slug: categorySlug });
    await User.deleteMany({ email: ownerEmail });

    const owner = await User.create({
      username: 'e2e-owner',
      email: ownerEmail,
      password: ownerPassword,
    });

    const category = await Category.create({
      name: 'E2E Smoke',
      slug: categorySlug,
    });

    const product = await Product.create({
      title: productTitle,
      description: 'Seeded product for Playwright smoke tests.',
      price: 12.5,
      imageUrl: '/homepage_background_laptop.webp',
      imageUrls: ['/homepage_background_laptop.webp'],
      category: category._id,
      owner: owner._id,
      availability: 'available',
    });

    const issuedAt = Math.floor(Date.now() / 1000);
    const expires = issuedAt + 60 * 60;
    const token = signJwt(
      {
        _id: owner._id.toString(),
        username: owner.username,
        email: owner.email,
        iat: issuedAt,
        exp: expires,
      },
      jwtSecret
    );

    await fs.mkdir(authDir, { recursive: true });
    await fs.writeFile(
      authStatePath,
      JSON.stringify(buildStorageState({ baseURL, token, expires }), null, 2)
    );

    process.env.E2E_PRODUCT_ID = product._id.toString();
  } finally {
    await mongoose.disconnect();
  }
}
