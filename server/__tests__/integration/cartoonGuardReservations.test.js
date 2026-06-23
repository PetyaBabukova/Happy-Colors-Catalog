import { describe, expect, it } from 'vitest';
import CartoonOrder from '../../models/CartoonOrder.js';
import CartoonOrderAbuseCounter from '../../models/CartoonOrderAbuseCounter.js';
import CartoonGuardReservation from '../../models/CartoonGuardReservation.js';
import {
  confirmGuardReservation,
  createGuardReservation,
  expireStaleGuardReservations,
  releaseGuardReservation,
} from '../../services/cartoonGuardReservationsService.js';
import { expireStalePersistentGuardReservations } from '../../services/cartoonOrdersService.js';

describe('cartoon guard reservation state transitions', () => {
  it('confirms or releases reservations only from the reserved state', async () => {
    await createGuardReservation({
      reservationId: 'reservation-1',
      reservationType: 'successful_inquiry',
      reservationGroupId: 'group-1',
      keyHmac: 'browser-key',
      keyType: 'browser',
      amount: 1,
      reservedAt: new Date('2026-06-18T10:00:00Z'),
      leaseExpiresAt: new Date('2026-06-18T10:30:00Z'),
    });

    await expect(confirmGuardReservation({
      reservationId: 'reservation-1',
      now: new Date('2026-06-18T10:01:00Z'),
    })).resolves.toBe(true);
    await expect(releaseGuardReservation({
      reservationId: 'reservation-1',
      now: new Date('2026-06-18T10:02:00Z'),
    })).resolves.toBe(false);

    const reservation = await CartoonGuardReservation.findOne({
      reservationId: 'reservation-1',
    }).lean();

    expect(reservation.status).toBe('confirmed');
    expect(reservation.confirmedAt).toBeInstanceOf(Date);
    expect(reservation.releasedAt).toBeNull();
    expect(reservation.expiresAt).toBeInstanceOf(Date);
    await expect(confirmGuardReservation({
      reservationId: 'reservation-1',
      now: new Date('2026-06-18T10:03:00Z'),
    })).resolves.toBe(false);
  });

  it('expires only stale reserved reservations and sums only their amounts', async () => {
    await createGuardReservation({
      reservationId: 'stale-upload-bytes',
      reservationType: 'upload_bytes',
      reservationGroupId: 'group-1',
      keyHmac: 'browser-key',
      keyType: 'browser',
      amount: 1024,
      reservedAt: new Date('2026-06-18T09:00:00Z'),
      leaseExpiresAt: new Date('2026-06-18T09:30:00Z'),
    });
    await createGuardReservation({
      reservationId: 'fresh-upload-bytes',
      reservationType: 'upload_bytes',
      reservationGroupId: 'group-2',
      keyHmac: 'browser-key',
      keyType: 'browser',
      amount: 2048,
      reservedAt: new Date('2026-06-18T10:00:00Z'),
      leaseExpiresAt: new Date('2026-06-18T10:30:00Z'),
    });
    await createGuardReservation({
      reservationId: 'stale-inquiry',
      reservationType: 'successful_inquiry',
      reservationGroupId: 'group-3',
      keyHmac: 'browser-key',
      keyType: 'browser',
      amount: 1,
      reservedAt: new Date('2026-06-18T09:00:00Z'),
      leaseExpiresAt: new Date('2026-06-18T09:30:00Z'),
    });

    const result = await expireStaleGuardReservations({
      now: new Date('2026-06-18T10:00:00Z'),
      reservationType: 'upload_bytes',
      keyHmac: 'browser-key',
      keyType: 'browser',
    });
    const reservations = await CartoonGuardReservation.find({}).sort({ reservationId: 1 }).lean();

    expect(result).toEqual({
      expiredCount: 1,
      expiredAmount: 1024,
    });
    expect(reservations.map((reservation) => [reservation.reservationId, reservation.status]))
      .toEqual([
        ['fresh-upload-bytes', 'reserved'],
        ['stale-inquiry', 'reserved'],
        ['stale-upload-bytes', 'expired'],
      ]);
  });

  it('confirms stale successful-inquiry reservations already linked to durable orders', async () => {
    const windowStart = new Date('2026-06-18T00:00:00Z');
    await CartoonOrderAbuseCounter.create({
      keyHmac: 'browser-key',
      keyType: 'browser',
      counterType: 'successful_inquiry',
      windowStart,
      windowExpiresAt: new Date('2026-06-19T00:00:00Z'),
      confirmedCount: 0,
      reservedCount: 1,
      createdAt: new Date('2026-06-18T09:00:00Z'),
      updatedAt: new Date('2026-06-18T09:00:00Z'),
    });
    await CartoonGuardReservation.create({
      reservationId: 'stale-durable-inquiry',
      reservationType: 'successful_inquiry',
      reservationGroupId: 'group-durable',
      keyHmac: 'browser-key',
      keyType: 'browser',
      counterWindowStart: windowStart,
      amount: 1,
      status: 'reserved',
      reservedAt: new Date('2026-06-18T09:00:00Z'),
      leaseExpiresAt: new Date('2026-06-18T09:30:00Z'),
    });
    await CartoonOrder.create({
      customer: {
        name: 'Petya Babukova',
        email: 'petya@example.com',
        phone: '',
        message: 'Please make a cartoon.',
      },
      photos: [
        {
          objectName: 'cartoon-orders/reference-photos/durable-reservation.webp',
          originalName: 'durable-reservation.webp',
          contentType: 'image/webp',
          size: 1234,
          uploadSessionId: 'durable-reservation-session',
        },
      ],
      consentAccepted: true,
      consentAcceptedAt: new Date('2026-06-18T09:01:00Z'),
      abuseGuardReservationIds: ['stale-durable-inquiry'],
    });

    const result = await expireStalePersistentGuardReservations({
      now: new Date('2026-06-18T10:00:00Z'),
    });
    const reservation = await CartoonGuardReservation.findOne({
      reservationId: 'stale-durable-inquiry',
    }).lean();
    const counter = await CartoonOrderAbuseCounter.findOne({
      keyHmac: 'browser-key',
      keyType: 'browser',
    }).lean();

    expect(result).toMatchObject({
      expiredCount: 0,
      expiredAmount: 0,
      confirmedCount: 1,
      confirmedAmount: 1,
    });
    expect(reservation.status).toBe('confirmed');
    expect(reservation.confirmedAt).toBeInstanceOf(Date);
    expect(counter).toMatchObject({
      reservedCount: 0,
      confirmedCount: 1,
    });
  });
});
