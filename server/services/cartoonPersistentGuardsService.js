import crypto from 'node:crypto';
import CartoonGuardLimitMetric from '../models/CartoonGuardLimitMetric.js';
import CartoonGuardReservation from '../models/CartoonGuardReservation.js';
import CartoonOrder from '../models/CartoonOrder.js';
import CartoonOrderAbuseCounter from '../models/CartoonOrderAbuseCounter.js';
import CartoonUploadCleanupRun from '../models/CartoonUploadCleanupRun.js';
import CartoonUploadQuotaCounter from '../models/CartoonUploadQuotaCounter.js';
import CartoonUploadSession from '../models/CartoonUploadSession.js';
import {
  createCartoonGuardHmacKey,
  arePersistentCartoonGuardsEnabled,
} from '../helpers/cartoonUploadGuards.js';

const SUCCESSFUL_INQUIRY_TYPE = 'successful_inquiry';
const UPLOAD_BYTES_TYPE = 'upload_bytes';
const DEFAULT_SUCCESSFUL_BROWSER_LIMIT = 5;
const DEFAULT_SUCCESSFUL_IP_LIMIT = 30;
const DEFAULT_SUCCESSFUL_WINDOW_HOURS = 24;
const DEFAULT_UPLOAD_BROWSER_BYTES = 75 * 1024 * 1024;
const DEFAULT_UPLOAD_IP_BYTES = 150 * 1024 * 1024;
const DEFAULT_RESERVATION_LEASE_MINUTES = 30;
const DEFAULT_LIMIT_METRIC_WINDOW_HOURS = 24;
const DEFAULT_CLEANUP_RUN_RETENTION_DAYS = 90;

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

function getTerminalReservationExpiresAt(now = new Date()) {
  const retentionDays = parsePositiveInteger(
    'CARTOON_GUARD_RESERVATION_RECORD_RETENTION_DAYS',
    90
  );

  return new Date(new Date(now).getTime() + retentionDays * 24 * 60 * 60 * 1000);
}

function createReservationId() {
  return crypto.randomUUID();
}

function buildGuardKeys({ browserValue, trustedIp }) {
  return [
    {
      keyType: 'browser',
      keyHmac: createCartoonGuardHmacKey({ keyType: 'browser', value: browserValue }),
    },
    {
      keyType: 'ip',
      keyHmac: createCartoonGuardHmacKey({ keyType: 'ip', value: trustedIp }),
    },
  ];
}

async function incrementLimitMetric(metricType, now = new Date()) {
  const windowHours = parsePositiveInteger(
    'CARTOON_GUARD_LIMIT_METRIC_WINDOW_HOURS',
    DEFAULT_LIMIT_METRIC_WINDOW_HOURS
  );
  const { windowStart, windowExpiresAt } = getWindow({ now, hours: windowHours });

  await CartoonGuardLimitMetric.updateOne(
    { metricType, windowStart },
    {
      $setOnInsert: { metricType, windowStart, windowExpiresAt },
      $inc: { count: 1 },
      $set: { updatedAt: now },
    },
    { upsert: true }
  );
}

async function reserveInquiryCounter({ keyHmac, keyType, amount, limit, now }) {
  const windowHours = parsePositiveInteger(
    'CARTOON_ORDER_SUCCESSFUL_INQUIRY_WINDOW_HOURS',
    DEFAULT_SUCCESSFUL_WINDOW_HOURS
  );
  const { windowStart, windowExpiresAt } = getWindow({ now, hours: windowHours });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await CartoonOrderAbuseCounter.updateOne(
      { keyHmac, keyType, counterType: SUCCESSFUL_INQUIRY_TYPE, windowStart },
      {
        $setOnInsert: {
          keyHmac,
          keyType,
          counterType: SUCCESSFUL_INQUIRY_TYPE,
          windowStart,
          windowExpiresAt,
          confirmedCount: 0,
          reservedCount: 0,
          createdAt: now,
        },
        $set: { updatedAt: now },
      },
      { upsert: true }
    );

    const counter = await CartoonOrderAbuseCounter.findOne({
      keyHmac,
      keyType,
      counterType: SUCCESSFUL_INQUIRY_TYPE,
      windowStart,
    }).lean();
    const confirmedCount = Number(counter?.confirmedCount) || 0;
    const reservedCount = Number(counter?.reservedCount) || 0;

    if (confirmedCount + reservedCount + amount > limit) {
      return { ok: false };
    }

    const result = await CartoonOrderAbuseCounter.updateOne(
      {
        keyHmac,
        keyType,
        counterType: SUCCESSFUL_INQUIRY_TYPE,
        windowStart,
        confirmedCount,
        reservedCount,
      },
      {
        $inc: { reservedCount: amount },
        $set: { updatedAt: now },
      }
    );

    if (result.modifiedCount === 1) {
      return { ok: true, windowStart };
    }
  }

  return { ok: false };
}

async function reserveByteCounter({ keyHmac, keyType, amount, limit, now }) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await CartoonUploadQuotaCounter.updateOne(
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

    const counter = await CartoonUploadQuotaCounter.findOne({ keyHmac, keyType }).lean();
    const confirmedOutstandingBytes = Number(counter?.confirmedOutstandingBytes) || 0;
    const reservedBytes = Number(counter?.reservedBytes) || 0;

    if (confirmedOutstandingBytes + reservedBytes + amount > limit) {
      return { ok: false };
    }

    const result = await CartoonUploadQuotaCounter.updateOne(
      {
        keyHmac,
        keyType,
        confirmedOutstandingBytes,
        reservedBytes,
      },
      {
        $inc: { reservedBytes: amount },
        $set: { updatedAt: now, zeroedAt: null },
      }
    );

    if (result.modifiedCount === 1) {
      return { ok: true };
    }
  }

  return { ok: false };
}

async function createReservation({
  reservationType,
  reservationGroupId,
  keyHmac,
  keyType,
  counterWindowStart = null,
  amount,
  now,
}) {
  const reservationId = createReservationId();

  await CartoonGuardReservation.create({
    reservationId,
    reservationType,
    reservationGroupId,
    keyHmac,
    keyType,
    counterWindowStart,
    amount,
    status: 'reserved',
    reservedAt: now,
    leaseExpiresAt: getReservationLeaseExpiresAt(now),
  });

  return { reservationId, reservationType, keyHmac, keyType, amount };
}

async function adjustCounterForReservation({ reservation, action, now }) {
  if (reservation.reservationType === SUCCESSFUL_INQUIRY_TYPE) {
    const update = action === 'confirm'
      ? { $inc: { reservedCount: -reservation.amount, confirmedCount: reservation.amount } }
      : { $inc: { reservedCount: -reservation.amount } };

    await CartoonOrderAbuseCounter.updateOne(
      {
        keyHmac: reservation.keyHmac,
        keyType: reservation.keyType,
        counterType: SUCCESSFUL_INQUIRY_TYPE,
        windowStart: reservation.counterWindowStart,
        reservedCount: { $gte: reservation.amount },
      },
      {
        ...update,
        $set: { updatedAt: now },
      }
    );
    return;
  }

  const update = action === 'confirm'
    ? {
        $inc: {
          reservedBytes: -reservation.amount,
          confirmedOutstandingBytes: reservation.amount,
        },
      }
    : { $inc: { reservedBytes: -reservation.amount } };

  const quotaUpdate = await CartoonUploadQuotaCounter.updateOne(
    {
      keyHmac: reservation.keyHmac,
      keyType: reservation.keyType,
      reservedBytes: { $gte: reservation.amount },
    },
    {
      ...update,
      $set: { updatedAt: now },
    }
  );

  if (quotaUpdate.modifiedCount === 1) {
    await CartoonUploadQuotaCounter.updateOne(
      {
        keyHmac: reservation.keyHmac,
        keyType: reservation.keyType,
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
}

async function transitionReservation({ reservationId, toStatus, timestampField, now = new Date() }) {
  const reservation = await CartoonGuardReservation.findOneAndUpdate(
    {
      reservationId,
      status: 'reserved',
    },
    {
      $set: {
        status: toStatus,
        [timestampField]: now,
        expiresAt: getTerminalReservationExpiresAt(now),
      },
    },
    { new: false }
  ).lean();

  if (!reservation) {
    return false;
  }

  await adjustCounterForReservation({
    reservation,
    action: toStatus === 'confirmed' ? 'confirm' : 'release',
    now,
  });

  return true;
}

export async function expireStalePersistentGuardReservations({
  reservationType = null,
  keyHmac = null,
  keyType = null,
  now = new Date(),
  limit = 500,
} = {}) {
  const query = {
    status: 'reserved',
    leaseExpiresAt: { $lte: now },
  };

  if (reservationType) query.reservationType = reservationType;
  if (keyHmac) query.keyHmac = keyHmac;
  if (keyType) query.keyType = keyType;

  const reservations = await CartoonGuardReservation.find(query)
    .sort({ leaseExpiresAt: 1 })
    .limit(Math.min(Math.max(Number(limit) || 500, 1), 1000))
    .lean();
  let expiredCount = 0;
  let expiredAmount = 0;
  let confirmedCount = 0;
  let confirmedAmount = 0;

  for (const reservation of reservations) {
    const shouldConfirmDurableInquiry = reservation.reservationType === SUCCESSFUL_INQUIRY_TYPE &&
      await CartoonOrder.exists({ abuseGuardReservationIds: reservation.reservationId });
    const updated = await transitionReservation({
      reservationId: reservation.reservationId,
      toStatus: shouldConfirmDurableInquiry ? 'confirmed' : 'expired',
      timestampField: shouldConfirmDurableInquiry ? 'confirmedAt' : 'expiredAt',
      now,
    });

    if (updated) {
      if (shouldConfirmDurableInquiry) {
        confirmedCount += 1;
        confirmedAmount += Number(reservation.amount) || 0;
      } else {
        expiredCount += 1;
        expiredAmount += Number(reservation.amount) || 0;
      }
    }
  }

  return { expiredCount, expiredAmount, confirmedCount, confirmedAmount };
}

export async function releaseGuardReservationGroup(reservations = [], now = new Date()) {
  for (const reservation of reservations) {
    await transitionReservation({
      reservationId: reservation.reservationId,
      toStatus: 'released',
      timestampField: 'releasedAt',
      now,
    });
  }
}

export async function confirmGuardReservationGroup(reservations = [], now = new Date()) {
  for (const reservation of reservations) {
    await transitionReservation({
      reservationId: reservation.reservationId,
      toStatus: 'confirmed',
      timestampField: 'confirmedAt',
      now,
    });
  }
}

export async function reserveSuccessfulInquiryGuard({
  browserValue,
  trustedIp,
  now = new Date(),
} = {}) {
  if (!arePersistentCartoonGuardsEnabled()) {
    return { ok: true, reservations: [], enabled: false };
  }

  const keys = buildGuardKeys({ browserValue, trustedIp });
  const reservationGroupId = createReservationId();
  const reservations = [];
  const limits = {
    browser: parsePositiveInteger(
      'CARTOON_ORDER_SUCCESSFUL_INQUIRY_BROWSER_LIMIT',
      DEFAULT_SUCCESSFUL_BROWSER_LIMIT
    ),
    ip: parsePositiveInteger(
      'CARTOON_ORDER_SUCCESSFUL_INQUIRY_IP_LIMIT',
      DEFAULT_SUCCESSFUL_IP_LIMIT
    ),
  };

  for (const key of keys) {
    await expireStalePersistentGuardReservations({
      reservationType: SUCCESSFUL_INQUIRY_TYPE,
      keyHmac: key.keyHmac,
      keyType: key.keyType,
      now,
    });

    const reserved = await reserveInquiryCounter({
      ...key,
      amount: 1,
      limit: limits[key.keyType],
      now,
    });

    if (!reserved.ok) {
      await releaseGuardReservationGroup(reservations, now);
      await incrementLimitMetric('successful_inquiry_limit_hit', now);
      return { ok: false, status: 429, reservations: [], enabled: true };
    }

    reservations.push(await createReservation({
      reservationType: SUCCESSFUL_INQUIRY_TYPE,
      reservationGroupId,
      ...key,
      counterWindowStart: reserved.windowStart,
      amount: 1,
      now,
    }));
  }

  return { ok: true, reservations, enabled: true };
}

export async function reserveUploadByteGuard({
  browserHmac,
  ipHmac,
  amount,
  now = new Date(),
} = {}) {
  if (!arePersistentCartoonGuardsEnabled()) {
    return { ok: true, reservations: [], enabled: false };
  }

  const keys = [
    { keyType: 'browser', keyHmac: browserHmac },
    { keyType: 'ip', keyHmac: ipHmac },
  ];
  const reservationGroupId = createReservationId();
  const reservations = [];
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

  for (const key of keys) {
    await expireStalePersistentGuardReservations({
      reservationType: UPLOAD_BYTES_TYPE,
      keyHmac: key.keyHmac,
      keyType: key.keyType,
      now,
    });

    const reserved = await reserveByteCounter({
      ...key,
      amount,
      limit: limits[key.keyType],
      now,
    });

    if (!reserved.ok) {
      await releaseGuardReservationGroup(reservations, now);
      await incrementLimitMetric('upload_byte_limit_hit', now);
      return { ok: false, status: 429, reservations: [], enabled: true };
    }

    reservations.push(await createReservation({
      reservationType: UPLOAD_BYTES_TYPE,
      reservationGroupId,
      ...key,
      amount,
      now,
    }));
  }

  return { ok: true, reservations, enabled: true };
}

export async function decrementUploadByteGaugeForGuardRefs({
  guard = {},
  size = 0,
  now = new Date(),
} = {}) {
  if (!arePersistentCartoonGuardsEnabled()) {
    return { releasedCount: 0, releasedBytes: 0 };
  }

  const amount = Math.max(Number(size) || 0, 0);
  const refs = [
    { keyType: 'browser', keyHmac: guard.browserHmac },
    { keyType: 'ip', keyHmac: guard.ipHmac },
  ].filter((ref) => ref.keyHmac && amount > 0);
  let releasedCount = 0;

  for (const ref of refs) {
    await CartoonUploadQuotaCounter.updateOne(
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
    releasedCount += 1;
  }

  return { releasedCount, releasedBytes: releasedCount > 0 ? amount : 0 };
}

export async function reconcileUploadByteGaugeCounters({ now = new Date() } = {}) {
  const sessions = await CartoonUploadSession.find({
    uploadedObjects: { $exists: true, $ne: [] },
  }).lean();
  const durableOrderPhotoRefs = new Set(
    (await CartoonOrder.find({}, { 'photos.objectName': 1 }).lean()).flatMap((order) => (
      (order.photos || []).map((photo) => `${String(order._id)}:${String(photo.objectName || '')}`)
    ))
  );
  const expected = new Map();
  let skippedMissingGuardCount = 0;

  for (const session of sessions) {
    for (const uploadedObject of session.uploadedObjects || []) {
      if (
        uploadedObject.byteGaugeReleasedAt ||
        (
          uploadedObject.claimedOrderId &&
          durableOrderPhotoRefs.has(
            `${String(uploadedObject.claimedOrderId)}:${String(uploadedObject.objectName || '')}`
          )
        )
      ) {
        continue;
      }

      const amount = Number(uploadedObject.size) || 0;
      const refs = [
        { keyType: 'browser', keyHmac: uploadedObject.guard?.browserHmac },
        { keyType: 'ip', keyHmac: uploadedObject.guard?.ipHmac },
      ];

      for (const ref of refs) {
        if (!ref.keyHmac || amount <= 0) {
          skippedMissingGuardCount += 1;
          continue;
        }

        const key = `${ref.keyType}:${ref.keyHmac}`;
        const current = expected.get(key) || { ...ref, bytes: 0 };
        current.bytes += amount;
        expected.set(key, current);
      }
    }
  }

  const existingCounters = await CartoonUploadQuotaCounter.find({}).lean();
  let repairedCounterCount = 0;
  let repairedBytes = 0;
  const expectedKeys = new Set(expected.keys());

  for (const counter of existingCounters) {
    const key = `${counter.keyType}:${counter.keyHmac}`;
    const expectedBytes = expected.get(key)?.bytes || 0;
    const currentBytes = Number(counter.confirmedOutstandingBytes) || 0;

    if (currentBytes !== expectedBytes) {
      repairedCounterCount += 1;
      repairedBytes += Math.abs(currentBytes - expectedBytes);
      await CartoonUploadQuotaCounter.updateOne(
        { _id: counter._id },
        {
          $set: {
            confirmedOutstandingBytes: expectedBytes,
            updatedAt: now,
            zeroedAt: expectedBytes === 0 && Number(counter.reservedBytes || 0) === 0 ? now : null,
          },
        }
      );
    }
  }

  for (const [key, value] of expected.entries()) {
    if (existingCounters.some((counter) => `${counter.keyType}:${counter.keyHmac}` === key)) {
      continue;
    }

    repairedCounterCount += 1;
    repairedBytes += value.bytes;
    await CartoonUploadQuotaCounter.create({
      keyHmac: value.keyHmac,
      keyType: value.keyType,
      confirmedOutstandingBytes: value.bytes,
      reservedBytes: 0,
      updatedAt: now,
      zeroedAt: null,
    });
  }

  const retentionDays = parsePositiveInteger('CARTOON_UPLOAD_CLEANUP_RUN_RETENTION_DAYS', DEFAULT_CLEANUP_RUN_RETENTION_DAYS);
  await CartoonUploadCleanupRun.create({
    startedAt: now,
    finishedAt: now,
    runType: 'byte_gauge_reconciliation',
    status: 'success',
    retentionHours: 0,
    reconciliationStatus: 'success',
    reconciliationRepairedCounterCount: repairedCounterCount,
    reconciliationRepairedBytes: repairedBytes,
    errorCategory: 'none',
    expiresAt: new Date(new Date(now).getTime() + retentionDays * 24 * 60 * 60 * 1000),
  }).catch(() => {});

  return {
    repairedCounterCount,
    repairedBytes,
    skippedMissingGuardCount,
    expectedCounterCount: expectedKeys.size,
  };
}
