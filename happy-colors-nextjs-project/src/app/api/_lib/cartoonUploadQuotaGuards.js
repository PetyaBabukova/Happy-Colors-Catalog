import { randomUUID } from 'crypto';

import { connectToMongo } from './mongo';
import {
  arePersistentCartoonGuardsEnabled,
  createBrowserGuardCookieValue,
  createCartoonGuardHmacKey,
  getBrowserGuardCookieName,
  getTrustedClientIpFromNextRequest,
} from './cartoonUploadGuards';

const DEFAULT_UPLOAD_BROWSER_BYTES = 75 * 1024 * 1024;
const DEFAULT_UPLOAD_IP_BYTES = 150 * 1024 * 1024;
const DEFAULT_RESERVATION_LEASE_MINUTES = 30;
const DEFAULT_LIMIT_METRIC_WINDOW_HOURS = 24;
const DEFAULT_TERMINAL_RECORD_RETENTION_DAYS = 90;
let indexesEnsured = false;

function parsePositiveInteger(name, fallback) {
  const value = Number.parseInt(process.env[name], 10);

  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function parseUploadByteLimit({ bytesEnvName, megabytesEnvName, fallback }) {
  const bytesValue = Number.parseInt(process.env[bytesEnvName], 10);

  if (Number.isFinite(bytesValue) && bytesValue > 0) {
    return bytesValue;
  }

  const megabytesValue = Number.parseInt(process.env[megabytesEnvName], 10);

  if (Number.isFinite(megabytesValue) && megabytesValue > 0) {
    return megabytesValue * 1024 * 1024;
  }

  return fallback;
}

async function getCollection(name) {
  const mongoose = await connectToMongo();

  return mongoose.connection.db.collection(name);
}

async function ensurePersistentGuardIndexes() {
  if (indexesEnsured) {
    return;
  }

  const [quotaCollection, reservationsCollection, metricsCollection] = await Promise.all([
    getCollection('cartoon_upload_quota_counters'),
    getCollection('cartoon_guard_reservations'),
    getCollection('cartoon_guard_limit_metrics'),
  ]);

  await Promise.all([
    quotaCollection.createIndex(
      { keyHmac: 1, keyType: 1 },
      { unique: true, background: true }
    ),
    quotaCollection.createIndex(
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
    ),
    reservationsCollection.createIndex(
      { reservationId: 1 },
      { unique: true, background: true }
    ),
    reservationsCollection.createIndex(
      { reservationType: 1, keyHmac: 1, keyType: 1, status: 1 },
      { background: true }
    ),
    reservationsCollection.createIndex(
      { leaseExpiresAt: 1, status: 1 },
      { background: true }
    ),
    reservationsCollection.createIndex(
      { expiresAt: 1 },
      {
        expireAfterSeconds: 0,
        background: true,
        partialFilterExpression: { expiresAt: { $type: 'date' } },
      }
    ),
    metricsCollection.createIndex(
      { metricType: 1, windowStart: 1 },
      { unique: true, background: true }
    ),
    metricsCollection.createIndex(
      { windowExpiresAt: 1 },
      { expireAfterSeconds: 0, background: true }
    ),
  ]);

  indexesEnsured = true;
}

function getReservationLeaseExpiresAt(now = new Date()) {
  const minutes = parsePositiveInteger(
    'CARTOON_GUARD_RESERVATION_LEASE_MINUTES',
    DEFAULT_RESERVATION_LEASE_MINUTES
  );

  return new Date(new Date(now).getTime() + minutes * 60 * 1000);
}

function getWindow({ now = new Date(), hours }) {
  const windowMs = hours * 60 * 60 * 1000;
  const timestamp = new Date(now).getTime();
  const windowStart = new Date(Math.floor(timestamp / windowMs) * windowMs);

  return {
    windowStart,
    windowExpiresAt: new Date(windowStart.getTime() + windowMs),
  };
}

async function incrementUploadByteLimitHit(now = new Date()) {
  const collection = await getCollection('cartoon_guard_limit_metrics');
  const { windowStart, windowExpiresAt } = getWindow({
    now,
    hours: parsePositiveInteger(
      'CARTOON_GUARD_LIMIT_METRIC_WINDOW_HOURS',
      DEFAULT_LIMIT_METRIC_WINDOW_HOURS
    ),
  });

  await collection.updateOne(
    { metricType: 'upload_byte_limit_hit', windowStart },
    {
      $setOnInsert: { metricType: 'upload_byte_limit_hit', windowStart, windowExpiresAt },
      $inc: { count: 1 },
      $set: { updatedAt: now },
    },
    { upsert: true }
  );
}

async function expireStaleByteReservations({ keyHmac, keyType, now = new Date() }) {
  const reservationsCollection = await getCollection('cartoon_guard_reservations');
  const quotaCollection = await getCollection('cartoon_upload_quota_counters');
  const staleReservations = await reservationsCollection.find({
    reservationType: 'upload_bytes',
    keyHmac,
    keyType,
    status: 'reserved',
    leaseExpiresAt: { $lte: now },
  }).limit(100).toArray();

  for (const reservation of staleReservations) {
    const updated = await reservationsCollection.updateOne(
      { reservationId: reservation.reservationId, status: 'reserved' },
      {
        $set: {
          status: 'expired',
          expiredAt: now,
          expiresAt: new Date(
            now.getTime() + DEFAULT_TERMINAL_RECORD_RETENTION_DAYS * 24 * 60 * 60 * 1000
          ),
        },
      }
    );

    if (updated.modifiedCount === 1) {
      await quotaCollection.updateOne(
        { keyHmac, keyType, reservedBytes: { $gte: Number(reservation.amount) || 0 } },
        {
          $inc: { reservedBytes: -(Number(reservation.amount) || 0) },
          $set: { updatedAt: now },
        }
      );
    }
  }
}

async function reserveByteCounter({ keyHmac, keyType, amount, limit, now }) {
  const collection = await getCollection('cartoon_upload_quota_counters');

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await collection.updateOne(
      { keyHmac, keyType },
      {
        $setOnInsert: {
          keyHmac,
          keyType,
          confirmedOutstandingBytes: 0,
          reservedBytes: 0,
        },
        $set: { updatedAt: now, zeroedAt: null },
      },
      { upsert: true }
    );

    const counter = await collection.findOne({ keyHmac, keyType });
    const confirmedOutstandingBytes = Number(counter?.confirmedOutstandingBytes) || 0;
    const reservedBytes = Number(counter?.reservedBytes) || 0;

    if (confirmedOutstandingBytes + reservedBytes + amount > limit) {
      return false;
    }

    const result = await collection.updateOne(
      { keyHmac, keyType, confirmedOutstandingBytes, reservedBytes },
      {
        $inc: { reservedBytes: amount },
        $set: { updatedAt: now, zeroedAt: null },
      }
    );

    if (result.modifiedCount === 1) {
      return true;
    }
  }

  return false;
}

async function createReservation({ reservationGroupId, keyHmac, keyType, amount, now }) {
  const collection = await getCollection('cartoon_guard_reservations');
  const reservationId = randomUUID();

  await collection.insertOne({
    reservationId,
    reservationType: 'upload_bytes',
    reservationGroupId,
    keyHmac,
    keyType,
    amount,
    status: 'reserved',
    reservedAt: now,
    leaseExpiresAt: getReservationLeaseExpiresAt(now),
    confirmedAt: null,
    releasedAt: null,
    expiredAt: null,
    expiresAt: null,
  });

  return { reservationId, keyHmac, keyType, amount };
}

async function transitionByteReservation({ reservationId, toStatus, timestampField, now = new Date() }) {
  const reservationsCollection = await getCollection('cartoon_guard_reservations');
  const quotaCollection = await getCollection('cartoon_upload_quota_counters');
  const reservation = await reservationsCollection.findOneAndUpdate(
    { reservationId, status: 'reserved' },
    {
      $set: {
        status: toStatus,
        [timestampField]: now,
        expiresAt: new Date(
          now.getTime() + DEFAULT_TERMINAL_RECORD_RETENTION_DAYS * 24 * 60 * 60 * 1000
        ),
      },
    },
    { returnDocument: 'before' }
  );
  const record = reservation?.value || reservation;

  if (!record?.reservationId) {
    return false;
  }

  const amount = Number(record.amount) || 0;
  const update = toStatus === 'confirmed'
    ? { $inc: { reservedBytes: -amount, confirmedOutstandingBytes: amount } }
    : { $inc: { reservedBytes: -amount } };

  const quotaUpdate = await quotaCollection.updateOne(
    {
      keyHmac: record.keyHmac,
      keyType: record.keyType,
      reservedBytes: { $gte: amount },
    },
    {
      ...update,
      $set: { updatedAt: now },
    }
  );

  if (quotaUpdate.modifiedCount === 1) {
    await quotaCollection.updateOne(
      {
        keyHmac: record.keyHmac,
        keyType: record.keyType,
      },
      [
        {
          $set: {
            zeroedAt: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$confirmedOutstandingBytes', 0] },
                    { $eq: ['$reservedBytes', 0] },
                  ],
                },
                now,
                null,
              ],
            },
          },
        },
      ]
    );
  }

  return true;
}

export function getOrCreateBrowserGuardValue(request) {
  const cookieName = getBrowserGuardCookieName();
  const existingValue = String(request?.cookies?.get?.(cookieName)?.value || '').trim();

  return {
    cookieName,
    value: existingValue || createBrowserGuardCookieValue(),
    shouldSetCookie: !existingValue,
  };
}

export async function reserveUploadByteQuota({ request, amount, now = new Date() } = {}) {
  if (!arePersistentCartoonGuardsEnabled()) {
    const browserGuard = getOrCreateBrowserGuardValue(request);

    return {
      ok: true,
      enabled: false,
      reservations: [],
      browserGuard,
      guard: {},
    };
  }

  const browserGuard = getOrCreateBrowserGuardValue(request);
  await ensurePersistentGuardIndexes();
  const trustedIp = getTrustedClientIpFromNextRequest(request);
  const guard = {
    browserHmac: createCartoonGuardHmacKey({ keyType: 'browser', value: browserGuard.value }),
    ipHmac: createCartoonGuardHmacKey({ keyType: 'ip', value: trustedIp }),
  };
  const refs = [
    { keyType: 'browser', keyHmac: guard.browserHmac },
    { keyType: 'ip', keyHmac: guard.ipHmac },
  ];
  const limits = {
    browser: parseUploadByteLimit({
      bytesEnvName: 'CARTOON_UPLOAD_BYTE_BROWSER_LIMIT',
      megabytesEnvName: 'CARTOON_UPLOAD_BROWSER_BYTE_LIMIT_MB',
      fallback: DEFAULT_UPLOAD_BROWSER_BYTES,
    }),
    ip: parseUploadByteLimit({
      bytesEnvName: 'CARTOON_UPLOAD_BYTE_IP_LIMIT',
      megabytesEnvName: 'CARTOON_UPLOAD_IP_BYTE_LIMIT_MB',
      fallback: DEFAULT_UPLOAD_IP_BYTES,
    }),
  };
  const reservationGroupId = randomUUID();
  const reservations = [];

  for (const ref of refs) {
    await expireStaleByteReservations({ ...ref, now });
    const reserved = await reserveByteCounter({
      ...ref,
      amount,
      limit: limits[ref.keyType],
      now,
    });

    if (!reserved) {
      await releaseUploadByteQuotaReservations(reservations, now);
      await incrementUploadByteLimitHit(now);
      return { ok: false, enabled: true, reservations: [], browserGuard, guard };
    }

    reservations.push(await createReservation({
      reservationGroupId,
      ...ref,
      amount,
      now,
    }));
  }

  return { ok: true, enabled: true, reservations, browserGuard, guard };
}

export async function confirmUploadByteQuotaReservations(reservations = [], now = new Date()) {
  for (const reservation of reservations) {
    await transitionByteReservation({
      reservationId: reservation.reservationId,
      toStatus: 'confirmed',
      timestampField: 'confirmedAt',
      now,
    });
  }
}

export async function releaseUploadByteQuotaReservations(reservations = [], now = new Date()) {
  for (const reservation of reservations) {
    await transitionByteReservation({
      reservationId: reservation.reservationId,
      toStatus: 'released',
      timestampField: 'releasedAt',
      now,
    });
  }
}

export async function decrementUploadByteQuotaForGuardRefs({ guard = {}, size = 0, now = new Date() } = {}) {
  if (!arePersistentCartoonGuardsEnabled()) {
    return;
  }

  const amount = Math.max(Number(size) || 0, 0);
  const collection = await getCollection('cartoon_upload_quota_counters');
  const refs = [
    { keyType: 'browser', keyHmac: guard.browserHmac },
    { keyType: 'ip', keyHmac: guard.ipHmac },
  ].filter((ref) => ref.keyHmac && amount > 0);

  for (const ref of refs) {
    await collection.updateOne(
      {
        keyHmac: ref.keyHmac,
        keyType: ref.keyType,
      },
      [
        {
          $set: {
            confirmedOutstandingBytes: {
              $max: [{ $subtract: ['$confirmedOutstandingBytes', amount] }, 0],
            },
            updatedAt: now,
          },
        },
        {
          $set: {
            zeroedAt: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$confirmedOutstandingBytes', 0] },
                    { $eq: ['$reservedBytes', 0] },
                  ],
                },
                now,
                null,
              ],
            },
          },
        },
      ]
    );
  }
}
