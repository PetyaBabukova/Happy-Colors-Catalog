import mongoose from 'mongoose';
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
    getBucketName,
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
  process.env.GCS_BUCKET_NAME = 'test-bucket';
  process.env.NEWSLETTER_UNSUBSCRIBE_SECRET = 'test-newsletter-unsubscribe-secret';

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
  delete process.env.GCS_BUCKET_NAME;
  delete process.env.NEWSLETTER_UNSUBSCRIBE_SECRET;
});
