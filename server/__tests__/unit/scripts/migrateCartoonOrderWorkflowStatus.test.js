import { describe, expect, it, vi } from 'vitest';

import { migrateCartoonOrderWorkflowStatus } from '../../../../scripts/migrateCartoonOrderWorkflowStatus.js';

function buildModel({
  missing = 4,
  completedCandidates = 1,
  inquiryCandidates = 2,
  archivedNeedsReview = 1,
  updatedCompleted = completedCandidates,
  updatedInquiry = inquiryCandidates,
} = {}) {
  return {
    countDocuments: vi
      .fn()
      .mockResolvedValueOnce(missing)
      .mockResolvedValueOnce(completedCandidates)
      .mockResolvedValueOnce(inquiryCandidates)
      .mockResolvedValueOnce(archivedNeedsReview),
    updateMany: vi
      .fn()
      .mockResolvedValueOnce({ modifiedCount: updatedCompleted })
      .mockResolvedValueOnce({ modifiedCount: updatedInquiry }),
  };
}

describe('migrateCartoonOrderWorkflowStatus', () => {
  it('reports workflow classifications without mutating in dry-run mode', async () => {
    const model = buildModel();

    await expect(
      migrateCartoonOrderWorkflowStatus({ dryRun: true, CartoonOrderModel: model })
    ).resolves.toEqual({
      dryRun: true,
      missing: 4,
      completedCandidates: 1,
      inquiryCandidates: 2,
      archivedNeedsReview: 1,
      updatedCompleted: 0,
      updatedInquiry: 0,
    });
    expect(model.updateMany).not.toHaveBeenCalled();
  });

  it('backfills completed and active inquiry records without using legacy ordered flags', async () => {
    const model = buildModel();

    const result = await migrateCartoonOrderWorkflowStatus({ CartoonOrderModel: model });

    expect(result).toMatchObject({
      dryRun: false,
      updatedCompleted: 1,
      updatedInquiry: 2,
      archivedNeedsReview: 1,
    });
    expect(model.updateMany).toHaveBeenNthCalledWith(
      1,
      {
        workflowStatus: { $exists: false },
        completedAt: { $type: 'date' },
      },
      { $set: { workflowStatus: 'completed' } }
    );
    expect(model.updateMany).toHaveBeenNthCalledWith(
      2,
      {
        workflowStatus: { $exists: false },
        completedAt: null,
        archivedAt: null,
      },
      { $set: { workflowStatus: 'inquiry' } }
    );
    expect(JSON.stringify(model.updateMany.mock.calls)).not.toContain('statuses');
  });

  it('is idempotent when no records are missing workflow status', async () => {
    const model = buildModel({
      missing: 0,
      completedCandidates: 0,
      inquiryCandidates: 0,
      archivedNeedsReview: 0,
      updatedCompleted: 0,
      updatedInquiry: 0,
    });

    await expect(
      migrateCartoonOrderWorkflowStatus({ CartoonOrderModel: model })
    ).resolves.toMatchObject({
      missing: 0,
      updatedCompleted: 0,
      updatedInquiry: 0,
    });
  });
});
