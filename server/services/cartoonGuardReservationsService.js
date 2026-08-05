import crypto from 'node:crypto';
import CartoonGuardReservation from '../models/CartoonGuardReservation.js';

const DEFAULT_TERMINAL_RESERVATION_RETENTION_DAYS = 90;

export function createGuardReservationId() {
  return crypto.randomUUID();
}

function getTerminalReservationExpiresAt(now = new Date()) {
  const retentionDays = Number.parseInt(
    process.env.CARTOON_GUARD_RESERVATION_RECORD_RETENTION_DAYS,
    10
  );
  const safeRetentionDays = Number.isFinite(retentionDays) && retentionDays > 0
    ? retentionDays
    : DEFAULT_TERMINAL_RESERVATION_RETENTION_DAYS;

  return new Date(new Date(now).getTime() + safeRetentionDays * 24 * 60 * 60 * 1000);
}

export async function createGuardReservation({
  reservationId = createGuardReservationId(),
  reservationType,
  reservationGroupId = createGuardReservationId(),
  keyHmac,
  keyType,
  amount = 1,
  reservedAt = new Date(),
  leaseExpiresAt,
} = {}) {
  const safeReservedAt = new Date(reservedAt);
  const safeLeaseExpiresAt = leaseExpiresAt ? new Date(leaseExpiresAt) : null;

  if (!safeLeaseExpiresAt || Number.isNaN(safeLeaseExpiresAt.getTime())) {
    throw new Error('Guard reservation lease expiry is required.');
  }

  return CartoonGuardReservation.create({
    reservationId,
    reservationType,
    reservationGroupId,
    keyHmac,
    keyType,
    amount,
    status: 'reserved',
    reservedAt: safeReservedAt,
    leaseExpiresAt: safeLeaseExpiresAt,
  });
}

async function transitionReservationStatus({ reservationId, fromStatus, toStatus, timestampField, now }) {
  const result = await CartoonGuardReservation.updateOne(
    {
      reservationId,
      status: fromStatus,
    },
    {
      $set: {
        status: toStatus,
        [timestampField]: now,
        expiresAt: getTerminalReservationExpiresAt(now),
      },
    }
  );

  return result.modifiedCount === 1;
}

export function confirmGuardReservation({ reservationId, now = new Date() } = {}) {
  return transitionReservationStatus({
    reservationId,
    fromStatus: 'reserved',
    toStatus: 'confirmed',
    timestampField: 'confirmedAt',
    now,
  });
}

export function releaseGuardReservation({ reservationId, now = new Date() } = {}) {
  return transitionReservationStatus({
    reservationId,
    fromStatus: 'reserved',
    toStatus: 'released',
    timestampField: 'releasedAt',
    now,
  });
}

export async function expireStaleGuardReservations({
  now = new Date(),
  reservationType = null,
  keyHmac = null,
  keyType = null,
  limit = 500,
} = {}) {
  const query = {
    status: 'reserved',
    leaseExpiresAt: { $lte: now },
  };

  if (reservationType) {
    query.reservationType = reservationType;
  }

  if (keyHmac) {
    query.keyHmac = keyHmac;
  }

  if (keyType) {
    query.keyType = keyType;
  }

  const reservations = await CartoonGuardReservation.find(query)
    .sort({ leaseExpiresAt: 1 })
    .limit(Math.min(Math.max(Number(limit) || 500, 1), 1000))
    .lean();
  const totals = {
    expiredCount: 0,
    expiredAmount: 0,
  };

  for (const reservation of reservations) {
    const updated = await transitionReservationStatus({
      reservationId: reservation.reservationId,
      fromStatus: 'reserved',
      toStatus: 'expired',
      timestampField: 'expiredAt',
      now,
    });

    if (updated) {
      totals.expiredCount += 1;
      totals.expiredAmount += Number(reservation.amount) || 0;
    }
  }

  return totals;
}
