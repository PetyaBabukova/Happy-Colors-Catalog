import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let cleanupUnclaimedCartoonOrderUploads;
let connect;
let disconnect;
let dotenvConfig;
let existsSync;

async function loadScript() {
  return import('../../../../scripts/cleanupCartoonOrderUploads.js');
}

describe('cleanupCartoonOrderUploads script', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();

    delete process.env.MONGO_URI;
    delete process.env.GCS_BUCKET_NAME;
    delete process.env.GCS_CARTOON_ORDERS_BUCKET_NAME;
    delete process.env.CARTOON_UPLOAD_CLEANUP_RETENTION_DAYS;
    delete process.env.CARTOON_UPLOAD_CLEANUP_LIMIT;

    cleanupUnclaimedCartoonOrderUploads = vi.fn(async () => ({
      cutoff: new Date('2026-06-01T00:00:00.000Z'),
      scannedSessions: 2,
      candidateCount: 3,
      deletedCount: 1,
      preservedOrderLinkedCount: 1,
      skippedLockedCount: 2,
      skippedUnsafeCount: 0,
      failedCount: 0,
    }));
    connect = vi.fn(async () => {});
    disconnect = vi.fn(async () => {});
    dotenvConfig = vi.fn(() => {
      process.env.MONGO_URI = 'mongodb://env-loaded';
      process.env.GCS_CARTOON_ORDERS_BUCKET_NAME = 'cartoon-orders-bucket';

      return {};
    });
    existsSync = vi.fn((candidatePath) => {
      const isServerEnv = candidatePath.replaceAll('\\', '/').endsWith('/server/.env');

      if (isServerEnv) {
        process.env.MONGO_URI = 'mongodb://env-loaded';
        process.env.GCS_CARTOON_ORDERS_BUCKET_NAME = 'cartoon-orders-bucket';
      }

      return isServerEnv;
    });

    vi.doMock('dotenv', () => ({
      default: { config: dotenvConfig },
      config: dotenvConfig,
    }));
    vi.doMock('node:fs', () => ({
      default: { existsSync },
      existsSync,
    }));
    vi.doMock('../../../../server/mongoose.js', () => ({
      default: {
        connect,
        disconnect,
      },
    }));
    vi.doMock('../../../../server/services/cartoonOrdersService.js', () => ({
      cleanupUnclaimedCartoonOrderUploads,
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('loads env before requiring MONGO_URI', async () => {
    vi.stubEnv('MONGO_URI', '');
    const loadEnv = vi.fn(() => {
      process.env.MONGO_URI = 'mongodb://env-loaded';
      process.env.GCS_CARTOON_ORDERS_BUCKET_NAME = 'cartoon-orders-bucket';
    });
    const { cleanupCartoonOrderUploadsFromEnv } = await loadScript();

    await expect(cleanupCartoonOrderUploadsFromEnv({ loadEnv })).resolves.toMatchObject({
      cutoff: '2026-06-01T00:00:00.000Z',
      deletedCount: 1,
      skippedLockedCount: 2,
      failedCount: 0,
    });

    expect(loadEnv).toHaveBeenCalled();
    expect(connect).toHaveBeenCalledWith('mongodb://env-loaded');
    expect(cleanupUnclaimedCartoonOrderUploads).toHaveBeenCalledWith({
      retentionDays: 14,
      limit: 200,
    });
    expect(disconnect).toHaveBeenCalled();
  });

  it('uses positive cleanup env overrides and returns a failing CLI code for cleanup failures', async () => {
    vi.stubEnv('MONGO_URI', 'mongodb://direct-env');
    vi.stubEnv('GCS_CARTOON_ORDERS_BUCKET_NAME', 'cartoon-orders-bucket');
    vi.stubEnv('CARTOON_UPLOAD_CLEANUP_RETENTION_DAYS', '7');
    vi.stubEnv('CARTOON_UPLOAD_CLEANUP_LIMIT', '25');
    cleanupUnclaimedCartoonOrderUploads.mockResolvedValueOnce({
      cutoff: new Date('2026-06-01T00:00:00.000Z'),
      scannedSessions: 1,
      candidateCount: 1,
      deletedCount: 0,
      preservedOrderLinkedCount: 0,
      skippedLockedCount: 1,
      skippedUnsafeCount: 0,
      failedCount: 1,
      deletedObjectNames: ['cartoon-orders/reference-photos/deleted.webp'],
      failedObjectNames: ['cartoon-orders/reference-photos/failed.webp'],
    });
    const stdout = vi.fn();
    const stderr = vi.fn();
    const { runCleanupCartoonOrderUploadsCli } = await loadScript();

    await expect(runCleanupCartoonOrderUploadsCli({ stdout, stderr })).resolves.toBe(1);

    expect(dotenvConfig).not.toHaveBeenCalled();
    expect(connect).toHaveBeenCalledWith('mongodb://direct-env');
    expect(cleanupUnclaimedCartoonOrderUploads).toHaveBeenCalledWith({
      retentionDays: 7,
      limit: 25,
    });
    expect(stdout).toHaveBeenCalledWith(expect.stringContaining('"failedCount": 1'));
    expect(stdout).toHaveBeenCalledWith(expect.stringContaining('"skippedLockedCount": 1'));
    expect(stdout).not.toHaveBeenCalledWith(expect.stringContaining('deleted.webp'));
    expect(stdout).not.toHaveBeenCalledWith(expect.stringContaining('failed.webp'));
    expect(stderr).not.toHaveBeenCalled();
  });

  it('floors cleanup retention overrides to at least one day', async () => {
    vi.stubEnv('MONGO_URI', 'mongodb://direct-env');
    vi.stubEnv('GCS_CARTOON_ORDERS_BUCKET_NAME', 'cartoon-orders-bucket');
    vi.stubEnv('CARTOON_UPLOAD_CLEANUP_RETENTION_DAYS', '0.01');
    const { cleanupCartoonOrderUploadsFromEnv } = await loadScript();

    await cleanupCartoonOrderUploadsFromEnv();

    expect(cleanupUnclaimedCartoonOrderUploads).toHaveBeenCalledWith({
      retentionDays: 1,
      limit: 200,
    });
  });

  it('fails before connecting when storage bucket config is missing', async () => {
    vi.stubEnv('MONGO_URI', 'mongodb://direct-env');
    vi.stubEnv('GCS_CARTOON_ORDERS_BUCKET_NAME', '');
    vi.stubEnv('GCS_BUCKET_NAME', '');
    existsSync.mockReturnValue(false);
    const stderr = vi.fn();
    const { runCleanupCartoonOrderUploadsCli } = await loadScript();

    await expect(runCleanupCartoonOrderUploadsCli({ stdout: vi.fn(), stderr })).resolves.toBe(1);

    expect(connect).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenCalledWith('Cartoon order storage bucket is required.');
  });

  it('does not use the shared bucket fallback when NODE_ENV is unset', async () => {
    vi.stubEnv('NODE_ENV', '');
    vi.stubEnv('MONGO_URI', 'mongodb://direct-env');
    vi.stubEnv('GCS_CARTOON_ORDERS_BUCKET_NAME', '');
    vi.stubEnv('GCS_BUCKET_NAME', 'shared-public-bucket');
    existsSync.mockReturnValue(false);
    const stderr = vi.fn();
    const { runCleanupCartoonOrderUploadsCli } = await loadScript();

    await expect(runCleanupCartoonOrderUploadsCli({ stdout: vi.fn(), stderr })).resolves.toBe(1);

    expect(connect).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenCalledWith('Cartoon order storage bucket is required.');
  });

  it('keeps the cleanup env candidate order explicit', async () => {
    const { getCleanupEnvCandidates } = await loadScript();

    expect(
      getCleanupEnvCandidates({
        repoRoot: 'E:\\web_projects\\Happy-Colors\\Happy-Colors-Repo',
        isTest: true,
      }).map((candidatePath) => candidatePath.replaceAll('\\', '/'))
    ).toEqual(['E:/web_projects/Happy-Colors/Happy-Colors-Repo/.env.test']);
    expect(
      getCleanupEnvCandidates({
        repoRoot: 'E:\\web_projects\\Happy-Colors\\Happy-Colors-Repo',
        isTest: false,
      }).map((candidatePath) => candidatePath.replaceAll('\\', '/'))
    ).toEqual([
      'E:/web_projects/Happy-Colors/Happy-Colors-Repo/.env',
      'E:/web_projects/Happy-Colors/Happy-Colors-Repo/server/.env',
      'E:/web_projects/Happy-Colors/Happy-Colors-SECRETS/.env',
    ]);
  });

  it('skips partial env candidates instead of mixing cleanup config across files', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('MONGO_URI', '');
    vi.stubEnv('GCS_CARTOON_ORDERS_BUCKET_NAME', '');
    const { loadCleanupEnv } = await loadScript();
    const readPaths = [];
    const fileExists = vi.fn((candidatePath) => {
      const normalizedPath = candidatePath.replaceAll('\\', '/');

      return normalizedPath.endsWith('/.env') || normalizedPath.endsWith('/server/.env');
    });
    const readFile = vi.fn((candidatePath) => {
      const normalizedPath = candidatePath.replaceAll('\\', '/');
      readPaths.push(normalizedPath);

      return normalizedPath;
    });
    const parseEnv = vi.fn((fileContent) => {
      if (fileContent.endsWith('/server/.env')) {
        return {
          MONGO_URI: 'mongodb://server-env',
          GCS_CARTOON_ORDERS_BUCKET_NAME: 'cartoon-orders-bucket',
        };
      }

      return {
        MONGO_URI: 'mongodb://partial-root-env',
      };
    });

    loadCleanupEnv({ fileExists, readFile, parseEnv });

    expect(readPaths).toEqual([
      expect.stringMatching(/\/\.env$/),
      expect.stringMatching(/\/server\/\.env$/),
    ]);
    expect(parseEnv).toHaveBeenCalledTimes(2);
    expect(process.env.MONGO_URI).toBe('mongodb://server-env');
    expect(process.env.GCS_CARTOON_ORDERS_BUCKET_NAME).toBe('cartoon-orders-bucket');
  });
});
