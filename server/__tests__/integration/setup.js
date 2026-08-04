import mongoose from 'mongoose';
import { Readable } from 'node:stream';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, vi } from 'vitest';
import { resetRateLimiterState } from '../../middlewares/rateLimit.js';
import { resetSequence } from './factories.js';

let mongoServer;

vi.mock('../../helpers/sendEmail.js', () => ({
  sendEmail: vi.fn().mockResolvedValue({ messageId: 'test-message-id' }),
}));

vi.mock('../../helpers/gcsImageHelper.js', () => {
  const getBucketName = vi.fn(() => 'test-bucket');

  return {
    deleteImageFromGCS: vi.fn().mockResolvedValue(undefined),
    deleteGcsObjectByName: vi.fn().mockResolvedValue(undefined),
    listCartoonOrderPhotoObjects: vi.fn(async () => ({
      ok: true,
      objects: [],
      errorCategory: 'none',
    })),
    getBucketName,
    getCartoonOrdersBucketName: vi.fn(() => 'test-bucket'),
    getSafeCartoonPhotoStorageContext: vi.fn(() => ({
      runtimeSurface: 'express-admin',
      runtimeEnvClass: 'test',
      privateBucketConfigured: false,
      privateDiffersFromPublic: false,
      publicBucketFallbackActive: true,
      credentialSource: 'application_default_credentials',
      credentialFileResolved: false,
      usingApplicationDefaultCredentials: true,
    })),
    isCartoonOrderPhotoObjectName: vi.fn((objectName) => (
      typeof objectName === 'string' &&
      objectName.startsWith('cartoon-orders/reference-photos/') &&
      !objectName.split('/').some((part) => part === '..' || part === '.' || part.includes('\\'))
    )),
    checkCartoonOrderPhotoExists: vi.fn(async () => ({
      status: 'exists',
      errorCategory: '',
      code: '',
      name: '',
    })),
    createCartoonOrderPhotoDiagnosticSignedReadProbe: vi.fn(async () => (
      'https://signed.example.com/diagnostic-probe'
    )),
    createCartoonOrderPhotoReadStream: vi.fn(() => Readable.from([Buffer.from('mock-photo-bytes')])),
    createCartoonOrderPhotoSignedReadUrl: vi.fn(async ({ objectName }) => (
      `https://signed.example.com/${encodeURIComponent(objectName)}`
    )),
    extractObjectNameFromGcsUrl: vi.fn((assetUrl) => {
      if (!assetUrl) {
        return null;
      }

      const bucketName = getBucketName();

      if (!bucketName) {
        return null;
      }

      try {
        const url = new URL(assetUrl);
        const parts = url.pathname.split('/').filter(Boolean);

        if (url.protocol !== 'https:' || url.hostname !== 'storage.googleapis.com') {
          return null;
        }

        if (parts.includes('..') || parts.includes('.')) {
          return null;
        }

        if (parts.length < 2) {
          return null;
        }

        if (parts[0] !== bucketName) {
          return null;
        }

        return parts.slice(1).join('/');
      } catch {
        return null;
      }
    }),
  };
});

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'integration-jwt-secret';
  process.env.CATALOG_MODE = 'false';
  process.env.CLIENT_URL = 'http://localhost:3000';
  process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
  process.env.GCS_BUCKET_NAME = 'test-bucket';
  process.env.CARTOON_ORDER_ADMIN_EMAIL = 'cartoon-admin@example.com';
  process.env.NEWSLETTER_UNSUBSCRIBE_SECRET = 'test-newsletter-unsubscribe-secret';
  process.env.NEWSLETTER_TEST_RECIPIENTS = 'test-owner@example.com,test-copy@example.com';
  process.env.NEWSLETTER_PUBLIC_SITE_URL = 'https://happycolors.eu';
  process.env.NEWSLETTER_DEFAULT_IMAGE_URL = 'https://cdn.example.com/default-newsletter.webp';

  mongoServer = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
  });
  await mongoose.connect(mongoServer.getUri(), {
    dbName: 'happy-colors-integration',
  });
});

beforeEach(async () => {
  vi.clearAllMocks();
  resetRateLimiterState();
  resetSequence();

  const collections = await mongoose.connection.db.collections();

  await Promise.all(collections.map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer?.stop();

  delete process.env.JWT_SECRET;
  delete process.env.CATALOG_MODE;
  delete process.env.CLIENT_URL;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.GCS_BUCKET_NAME;
  delete process.env.CARTOON_ORDER_ADMIN_EMAIL;
  delete process.env.NEWSLETTER_UNSUBSCRIBE_SECRET;
  delete process.env.NEWSLETTER_TEST_RECIPIENTS;
  delete process.env.NEWSLETTER_PUBLIC_SITE_URL;
  delete process.env.NEWSLETTER_DEFAULT_IMAGE_URL;
});
