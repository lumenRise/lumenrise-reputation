import { Types } from 'mongoose';

import IntegrationSyncJob from '../../models/IntegrationSyncJob';
import type { IntegrationSyncJobDocument } from '../../types/integration/sync';
import finalizeExhaustedIntegrationSyncJobs from '../finalizeExhaustedIntegrationSyncJobs';
const SYNC_JOB_LEASE_MS = 3_600_000;

const claimGitHubSyncJob = async (
  jobId?: string,
  now = new Date(),
): Promise<IntegrationSyncJobDocument | null> => {
  await finalizeExhaustedIntegrationSyncJobs('github', now, jobId);
  return IntegrationSyncJob.findOneAndUpdate(
    {
      ...(jobId ? { _id: new Types.ObjectId(jobId) } : {}),
      provider: 'github',
      active: true,
      $expr: { $lt: ['$attempts', '$maxAttempts'] },
      $or: [
        { status: 'queued', scheduledAt: { $lte: now } },
        { status: 'running', leaseUntil: { $lte: now } },
      ],
    },
    {
      $set: {
        status: 'running',
        startedAt: now,
        completedAt: null,
        leaseUntil: new Date(now.getTime() + SYNC_JOB_LEASE_MS),
        lastError: null,
      },
      $inc: { attempts: 1 },
    },
    { sort: { scheduledAt: 1 }, runValidators: true, returnDocument: 'after' },
  );
};

export default claimGitHubSyncJob;
