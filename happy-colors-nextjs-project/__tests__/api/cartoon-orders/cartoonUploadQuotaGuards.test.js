import { beforeEach, describe, expect, it, vi } from 'vitest';

let collections;
const collection = vi.fn((name) => collections[name]);
const connectToMongo = vi.fn(async () => ({
  connection: {
    db: {
      collection,
    },
  },
}));

function matches(record, filter = {}) {
  return Object.entries(filter).every(([key, expected]) => {
    const actual = record[key];

    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      if ('$lte' in expected && !(actual <= expected.$lte)) return false;
      if ('$gte' in expected && !(actual >= expected.$gte)) return false;
      return !Object.keys(expected).some((operator) => !['$lte', '$gte'].includes(operator));
    }

    return actual === expected;
  });
}

function applyUpdate(record, update, { insert = false } = {}) {
  if (insert && update.$setOnInsert) {
    Object.assign(record, update.$setOnInsert);
  }

  if (update.$inc) {
    for (const [key, amount] of Object.entries(update.$inc)) {
      record[key] = (Number(record[key]) || 0) + amount;
    }
  }

  if (update.$set) {
    Object.assign(record, update.$set);
  }
}

function applyPipelineUpdate(record, pipeline) {
  if (!pipeline[0].$set.confirmedOutstandingBytes) {
    record.zeroedAt =
      record.confirmedOutstandingBytes === 0 && (Number(record.reservedBytes) || 0) === 0
        ? pipeline[0].$set.zeroedAt.$cond[1]
        : null;
    return;
  }

  const amountExpression = pipeline[0].$set.confirmedOutstandingBytes.$max[0].$subtract[1];

  record.confirmedOutstandingBytes = Math.max(
    (Number(record.confirmedOutstandingBytes) || 0) - amountExpression,
    0
  );
  record.updatedAt = pipeline[0].$set.updatedAt;
  record.zeroedAt =
    record.confirmedOutstandingBytes === 0 && (Number(record.reservedBytes) || 0) === 0
      ? pipeline[1].$set.zeroedAt.$cond[1]
      : null;
}

function createMemoryCollection() {
  const records = [];

  return {
    records,
    createIndex: vi.fn(async () => 'index-name'),
    find: vi.fn((filter = {}) => ({
      limit: vi.fn(() => ({
        toArray: vi.fn(async () => records.filter((record) => matches(record, filter))),
      })),
    })),
    findOne: vi.fn(async (filter = {}) => records.find((record) => matches(record, filter)) || null),
    findOneAndUpdate: vi.fn(async (filter = {}, update = {}) => {
      const record = records.find((candidate) => matches(candidate, filter));

      if (!record) {
        return null;
      }

      const before = { ...record };
      applyUpdate(record, update);

      return before;
    }),
    insertOne: vi.fn(async (record) => {
      records.push({ ...record });
      return { insertedId: record.reservationId };
    }),
    updateOne: vi.fn(async (filter = {}, update = {}, options = {}) => {
      let record = records.find((candidate) => matches(candidate, filter));

      if (!record && options.upsert) {
        record = {};
        for (const [key, value] of Object.entries(filter)) {
          if (!value || typeof value !== 'object') {
            record[key] = value;
          }
        }
        records.push(record);
        applyUpdate(record, update, { insert: true });
        return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
      }

      if (!record) {
        return { matchedCount: 0, modifiedCount: 0 };
      }

      if (Array.isArray(update)) {
        applyPipelineUpdate(record, update);
      } else {
        applyUpdate(record, update);
      }

      return { matchedCount: 1, modifiedCount: 1 };
    }),
  };
}

function createRequest({ cookieValue = '', ip = '203.0.113.10' } = {}) {
  return {
    cookies: {
      get: vi.fn(() => (cookieValue ? { value: cookieValue } : undefined)),
    },
    headers: {
      get: vi.fn((name) => (String(name).toLowerCase() === 'x-real-ip' ? ip : null)),
    },
  };
}

async function loadQuotaGuards() {
  return import('../../../src/app/api/_lib/cartoonUploadQuotaGuards.js');
}

describe('cartoonUploadQuotaGuards', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    collections = {
      cartoon_upload_quota_counters: createMemoryCollection(),
      cartoon_guard_reservations: createMemoryCollection(),
      cartoon_guard_limit_metrics: createMemoryCollection(),
    };

    vi.doMock('../../../src/app/api/_lib/env.js', () => ({
      ensureServerEnvLoaded: vi.fn(),
    }));
    vi.doMock('../../../src/app/api/_lib/mongo.js', () => ({
      connectToMongo,
    }));
  });

  it('does not require Mongo or a guard secret while persistent guards are disabled', async () => {
    const { reserveUploadByteQuota } = await loadQuotaGuards();

    await expect(
      reserveUploadByteQuota({ request: createRequest(), amount: 12 })
    ).resolves.toMatchObject({
      ok: true,
      enabled: false,
      reservations: [],
      browserGuard: {
        cookieName: 'hc_cartoon_guard',
        shouldSetCookie: true,
      },
      guard: {},
    });
    expect(connectToMongo).not.toHaveBeenCalled();
  });

  it('reserves and confirms browser and IP upload byte counters', async () => {
    vi.stubEnv('CARTOON_PERSISTENT_ABUSE_GUARDS_ENABLED', 'true');
    vi.stubEnv('CARTOON_GUARD_HMAC_SECRET', 'x'.repeat(32));
    const { confirmUploadByteQuotaReservations, reserveUploadByteQuota } = await loadQuotaGuards();

    const reservation = await reserveUploadByteQuota({
      request: createRequest({ cookieValue: 'browser-cookie' }),
      amount: 12,
    });

    expect(reservation).toMatchObject({
      ok: true,
      enabled: true,
      reservations: [{ amount: 12 }, { amount: 12 }],
      browserGuard: {
        shouldSetCookie: false,
      },
    });
    expect(collections.cartoon_upload_quota_counters.records).toHaveLength(2);
    expect(collections.cartoon_upload_quota_counters.createIndex).toHaveBeenCalledWith(
      { keyHmac: 1, keyType: 1 },
      { unique: true, background: true }
    );
    expect(collections.cartoon_upload_quota_counters.createIndex).toHaveBeenCalledWith(
      { zeroedAt: 1 },
      {
        expireAfterSeconds: 0,
        background: true,
        partialFilterExpression: {
          confirmedOutstandingBytes: 0,
          reservedBytes: 0,
          zeroedAt: { $type: 'date' },
        },
      }
    );
    expect(collections.cartoon_guard_reservations.createIndex).toHaveBeenCalledWith(
      { reservationId: 1 },
      { unique: true, background: true }
    );
    expect(collections.cartoon_guard_limit_metrics.createIndex).toHaveBeenCalledWith(
      { metricType: 1, windowStart: 1 },
      { unique: true, background: true }
    );
    expect(collections.cartoon_upload_quota_counters.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ keyType: 'browser', reservedBytes: 12 }),
        expect.objectContaining({ keyType: 'ip', reservedBytes: 12 }),
      ])
    );

    await confirmUploadByteQuotaReservations(reservation.reservations);

    expect(collections.cartoon_upload_quota_counters.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keyType: 'browser',
          reservedBytes: 0,
          confirmedOutstandingBytes: 12,
        }),
        expect.objectContaining({
          keyType: 'ip',
          reservedBytes: 0,
          confirmedOutstandingBytes: 12,
        }),
      ])
    );
  });

  it('releases a partial reservation and records a metric when the second key hits its byte limit', async () => {
    vi.stubEnv('CARTOON_PERSISTENT_ABUSE_GUARDS_ENABLED', 'true');
    vi.stubEnv('CARTOON_GUARD_HMAC_SECRET', 'x'.repeat(32));
    vi.stubEnv('CARTOON_UPLOAD_BYTE_BROWSER_LIMIT', '100');
    vi.stubEnv('CARTOON_UPLOAD_BYTE_IP_LIMIT', '10');
    const { reserveUploadByteQuota } = await loadQuotaGuards();

    const reservation = await reserveUploadByteQuota({
      request: createRequest({ cookieValue: 'browser-cookie' }),
      amount: 12,
    });

    expect(reservation).toMatchObject({ ok: false, enabled: true, reservations: [] });
    expect(collections.cartoon_upload_quota_counters.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ keyType: 'browser', reservedBytes: 0 }),
        expect.objectContaining({ keyType: 'ip', reservedBytes: 0 }),
      ])
    );
    expect(collections.cartoon_guard_reservations.records).toEqual([
      expect.objectContaining({ keyType: 'browser', status: 'released', amount: 12 }),
    ]);
    expect(collections.cartoon_guard_limit_metrics.records).toEqual([
      expect.objectContaining({ metricType: 'upload_byte_limit_hit', count: 1 }),
    ]);
  });

  it('supports documented megabyte upload byte limit env aliases', async () => {
    vi.stubEnv('CARTOON_PERSISTENT_ABUSE_GUARDS_ENABLED', 'true');
    vi.stubEnv('CARTOON_GUARD_HMAC_SECRET', 'x'.repeat(32));
    vi.stubEnv('CARTOON_UPLOAD_BROWSER_BYTE_LIMIT_MB', '3');
    vi.stubEnv('CARTOON_UPLOAD_IP_BYTE_LIMIT_MB', '1');
    const { reserveUploadByteQuota } = await loadQuotaGuards();

    const reservation = await reserveUploadByteQuota({
      request: createRequest({ cookieValue: 'browser-cookie' }),
      amount: 2 * 1024 * 1024,
    });

    expect(reservation).toMatchObject({ ok: false, enabled: true, reservations: [] });
    expect(collections.cartoon_guard_reservations.records).toEqual([
      expect.objectContaining({
        keyType: 'browser',
        status: 'released',
        amount: 2 * 1024 * 1024,
      }),
    ]);
    expect(collections.cartoon_guard_limit_metrics.records).toEqual([
      expect.objectContaining({ metricType: 'upload_byte_limit_hit', count: 1 }),
    ]);
  });

  it('decrements confirmed byte gauges without going below zero', async () => {
    vi.stubEnv('CARTOON_PERSISTENT_ABUSE_GUARDS_ENABLED', 'true');
    vi.stubEnv('CARTOON_GUARD_HMAC_SECRET', 'x'.repeat(32));
    const {
      confirmUploadByteQuotaReservations,
      decrementUploadByteQuotaForGuardRefs,
      reserveUploadByteQuota,
    } = await loadQuotaGuards();
    const reservation = await reserveUploadByteQuota({
      request: createRequest({ cookieValue: 'browser-cookie' }),
      amount: 12,
    });
    await confirmUploadByteQuotaReservations(reservation.reservations);

    await decrementUploadByteQuotaForGuardRefs({
      guard: reservation.guard,
      size: 20,
      now: new Date('2026-06-19T09:00:00Z'),
    });

    expect(collections.cartoon_upload_quota_counters.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keyType: 'browser',
          confirmedOutstandingBytes: 0,
          zeroedAt: new Date('2026-06-19T09:00:00Z'),
        }),
        expect.objectContaining({
          keyType: 'ip',
          confirmedOutstandingBytes: 0,
          zeroedAt: new Date('2026-06-19T09:00:00Z'),
        }),
      ])
    );
  });

  it('marks released 0/0 byte counters as zeroed for TTL cleanup', async () => {
    vi.stubEnv('CARTOON_PERSISTENT_ABUSE_GUARDS_ENABLED', 'true');
    vi.stubEnv('CARTOON_GUARD_HMAC_SECRET', 'x'.repeat(32));
    const {
      releaseUploadByteQuotaReservations,
      reserveUploadByteQuota,
    } = await loadQuotaGuards();
    const reservation = await reserveUploadByteQuota({
      request: createRequest({ cookieValue: 'browser-cookie' }),
      amount: 12,
    });

    await releaseUploadByteQuotaReservations(
      reservation.reservations,
      new Date('2026-06-19T09:01:00Z')
    );

    expect(collections.cartoon_upload_quota_counters.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keyType: 'browser',
          reservedBytes: 0,
          confirmedOutstandingBytes: 0,
          zeroedAt: new Date('2026-06-19T09:01:00Z'),
        }),
        expect.objectContaining({
          keyType: 'ip',
          reservedBytes: 0,
          confirmedOutstandingBytes: 0,
          zeroedAt: new Date('2026-06-19T09:01:00Z'),
        }),
      ])
    );
  });
});
