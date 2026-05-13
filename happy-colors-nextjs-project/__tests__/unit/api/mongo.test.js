import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mongoose } = vi.hoisted(() => ({
  mongoose: {
    set: vi.fn(),
    connect: vi.fn(),
    connection: { readyState: 0 },
  },
}));

vi.mock('mongoose', () => ({
  default: mongoose,
}));

async function loadMongo() {
  return import('../../../src/app/api/_lib/mongo.js');
}

describe('api mongo helper', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('MONGO_URI', 'mongodb://localhost:27017/happy-colors-test');
    mongoose.set.mockClear();
    mongoose.connect.mockReset();
    mongoose.connection.readyState = 0;
    mongoose.connect.mockResolvedValue(mongoose);
    vi.doMock('../../../src/app/api/_lib/env.js', () => ({
      ensureServerEnvLoaded: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('returns the existing mongoose connection when already connected', async () => {
    mongoose.connection.readyState = 1;
    const { connectToMongo } = await loadMongo();

    await expect(connectToMongo()).resolves.toBe(mongoose);
    expect(mongoose.connect).not.toHaveBeenCalled();
  });

  it('requires MONGO_URI before connecting', async () => {
    vi.stubEnv('MONGO_URI', '');
    const { connectToMongo } = await loadMongo();

    await expect(connectToMongo()).rejects.toThrow('MONGO_URI is not configured.');
    expect(mongoose.connect).not.toHaveBeenCalled();
  });

  it('connects once and reuses the pending connection promise', async () => {
    const { connectToMongo } = await loadMongo();

    await expect(Promise.all([connectToMongo(), connectToMongo()])).resolves.toEqual([mongoose, mongoose]);

    expect(mongoose.set).toHaveBeenCalledWith('strictQuery', true);
    expect(mongoose.connect).toHaveBeenCalledTimes(1);
    expect(mongoose.connect).toHaveBeenCalledWith('mongodb://localhost:27017/happy-colors-test');
  });
});
