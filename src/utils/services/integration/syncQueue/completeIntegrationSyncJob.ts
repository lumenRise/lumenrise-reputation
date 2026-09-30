import type { Types } from 'mongoose';

import IntegrationSyncJob from '../../../../models/IntegrationSyncJob';
import type { IntegrationSyncJobDocument } from '../../../../types/integration/sync';
const completeIntegrationSyncJob = async (
  job: IntegrationSyncJobDocument,
  snapshotId: Types.ObjectId,
  completedAt = new Date(),
): Promise<void> => {
  await IntegrationSyncJob.updateOne(
    { _id: job._id, status: 'running', leaseUntil: job.leaseUntil },
    {
      $set: {
        status: 'completed',
        active: false,
        completedAt,
        leaseUntil: null,
        resultSnapshot: snapshotId,
      },
    },
    { runValidators: true },
  );
};

export { completeIntegrationSyncJob };
