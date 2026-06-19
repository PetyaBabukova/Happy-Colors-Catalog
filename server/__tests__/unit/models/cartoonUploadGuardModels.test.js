import { describe, expect, it } from 'vitest';
import CartoonGuardLimitMetric from '../../../models/CartoonGuardLimitMetric.js';
import CartoonGuardReservation from '../../../models/CartoonGuardReservation.js';
import CartoonOrderAbuseCounter from '../../../models/CartoonOrderAbuseCounter.js';
import CartoonUploadCleanupRun from '../../../models/CartoonUploadCleanupRun.js';
import CartoonUploadQuotaCounter from '../../../models/CartoonUploadQuotaCounter.js';
import CartoonUploadSession from '../../../models/CartoonUploadSession.js';

function schemaPathNames(model) {
  return Object.keys(model.schema.paths);
}

describe('cartoon upload guard model contracts', () => {
  it('extends upload-session objects with nullable guard and cleanup markers without a TTL index', () => {
    const objectPaths = Object.keys(
      CartoonUploadSession.schema.path('uploadedObjects').schema.paths
    );
    const indexes = CartoonUploadSession.schema.indexes();
    const expiresAtIndex = indexes.find(([keys]) => keys.expiresAt === 1);

    expect(objectPaths).toEqual(expect.arrayContaining([
      'guard.browserHmac',
      'guard.ipHmac',
      'cleanupRequestedAt',
      'cleanupFailedAt',
      'cleanupFailureCategory',
      'byteGaugeReleasedAt',
      'orphanReapingAt',
      'orderPersistingAt',
    ]));
    expect(
      CartoonUploadSession.schema.path('uploadedObjects').schema.path('cleanupFailureCategory')
        .enumValues
    ).toContain('unknown_cleanup_error');
    expect(expiresAtIndex?.[1]).toEqual({ background: true });
    expect(expiresAtIndex?.[1]?.expireAfterSeconds).toBeUndefined();
  });

  it('keeps abuse counters and limit metrics free of raw identity and storage fields', () => {
    const sensitivePathFragments = [
      'rawIp',
      'browserId',
      'cookie',
      'uploadSessionId',
      'objectName',
      'bucket',
      'providerMessage',
    ];
    const models = [
      CartoonGuardReservation,
      CartoonUploadQuotaCounter,
      CartoonUploadCleanupRun,
      CartoonOrderAbuseCounter,
      CartoonGuardLimitMetric,
    ];

    for (const model of models) {
      const paths = schemaPathNames(model);

      for (const fragment of sensitivePathFragments) {
        expect(paths.some((path) => path.toLowerCase().includes(fragment.toLowerCase()))).toBe(false);
      }
    }

    expect(schemaPathNames(CartoonGuardLimitMetric)).not.toContain('keyHmac');
  });

  it('defines bounded enum fields and TTL only for short-lived aggregate records', () => {
    expect(CartoonGuardReservation.schema.path('status').enumValues).toEqual([
      'reserved',
      'confirmed',
      'released',
      'expired',
    ]);
    expect(CartoonGuardReservation.schema.indexes()).toEqual(
      expect.arrayContaining([
        [
          { expiresAt: 1 },
          {
            expireAfterSeconds: 0,
            background: true,
            partialFilterExpression: { expiresAt: { $type: 'date' } },
          },
        ],
      ])
    );
    expect(CartoonUploadCleanupRun.schema.path('errorCategory').enumValues).toContain(
      'unknown_cleanup_error'
    );
    expect(CartoonUploadCleanupRun.schema.path('runType').enumValues).toEqual([
      'unclaimed_upload_cleanup',
      'claimed_orphan_reaper',
      'recordless_sweep',
      'byte_gauge_reconciliation',
    ]);
    expect(CartoonUploadCleanupRun.schema.indexes()).toEqual(
      expect.arrayContaining([
        [{ runType: 1, startedAt: -1 }, { background: true }],
      ])
    );
    expect(CartoonOrderAbuseCounter.schema.indexes()).toEqual(
      expect.arrayContaining([
        [{ windowExpiresAt: 1 }, { expireAfterSeconds: 0, background: true }],
      ])
    );
    expect(CartoonUploadQuotaCounter.schema.indexes()).toEqual(
      expect.arrayContaining([
        [
          { zeroedAt: 1 },
          {
            expireAfterSeconds: 0,
            background: true,
            partialFilterExpression: {
              confirmedOutstandingBytes: 0,
              reservedBytes: 0,
              zeroedAt: { $type: 'date' },
            },
          },
        ],
      ])
    );
    expect(CartoonGuardLimitMetric.schema.indexes()).toEqual(
      expect.arrayContaining([
        [{ windowExpiresAt: 1 }, { expireAfterSeconds: 0, background: true }],
      ])
    );
  });
});
