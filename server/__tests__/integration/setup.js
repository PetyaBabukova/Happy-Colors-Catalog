import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, vi } from 'vitest';

let mongoServer;

vi.mock('../../helpers/sendEmail.js', () => ({
  sendEmail: vi.fn().mockResolvedValue({ messageId: 'test-message-id' }),
}));

vi.mock('../../helpers/gcsImageHelper.js', () => ({
  deleteImageFromGCS: vi.fn().mockResolvedValue(undefined),
  getBucketName: vi.fn(() => 'test-bucket'),
  extractObjectNameFromGcsUrl: vi.fn((url) => String(url || '').split('/').pop() || ''),
}));

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'integration-jwt-secret';
  process.env.CATALOG_MODE = 'false';
  process.env.CLIENT_URL = 'http://localhost:3000';
  process.env.GCS_BUCKET_NAME = 'test-bucket';

  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), {
    dbName: 'happy-colors-integration',
  });
});

beforeEach(async () => {
  vi.clearAllMocks();

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
});
