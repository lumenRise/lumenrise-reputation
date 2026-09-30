import { Types } from 'mongoose';

import IntegrationSyncJob from '../models/IntegrationSyncJob';

const finalizeExhaustedIntegrationSyncJobs = async (
  provider: 'github' | 'x',
  now: Date,
  jobId?: string,
): Promise<void> => {
  await IntegrationSyncJob.updateMany(
    {
      ...(jobId ? { _id: new Types.ObjectId(jobId) } : {}),
      provider,
      active: true,
      $expr: { $gte: ['$attempts', '$maxAttempts'] },
      $or: [
        { status: 'queued', scheduledAt: { $lte: now } },
        { status: 'running', leaseUntil: { $lte: now } },
      ],
    },
    {
      $set: {
        status: 'failed',
        active: false,
        leaseUntil: null,
        completedAt: now,
        lastError: 'Retry limit reached after worker interruption',
      },
    },
    { runValidators: true },
  );
};

export default finalizeExhaustedIntegrationSyncJobs;
