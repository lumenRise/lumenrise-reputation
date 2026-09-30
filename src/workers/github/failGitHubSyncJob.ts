import IntegrationSyncJob from '../../models/IntegrationSyncJob';
import type { IntegrationSyncJobDocument } from '../../types/integration/sync';
import { calculateSyncRetryDelay } from '../../utils/services/integration/syncQueue/calculateSyncRetryDelay';

const failGitHubSyncJob = async (
  job: IntegrationSyncJobDocument,
  reason: string,
  retryable: boolean,
): Promise<void> => {
  const shouldRetry = retryable && job.attempts < job.maxAttempts;
  await IntegrationSyncJob.updateOne(
    { _id: job._id, status: 'running', leaseUntil: job.leaseUntil },
    {
      $set: {
        status: shouldRetry ? 'queued' : 'failed',
        active: shouldRetry,
        scheduledAt: shouldRetry ? new Date(Date.now() + calculateSyncRetryDelay(job.attempts)) : job.scheduledAt,
        completedAt: shouldRetry ? null : new Date(),
        leaseUntil: null,
        lastError: reason.slice(0, 2_000),
      },
    },
    { runValidators: true },
  );
};

export default failGitHubSyncJob;
