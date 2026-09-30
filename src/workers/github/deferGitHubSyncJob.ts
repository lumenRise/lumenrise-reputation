import IntegrationSyncJob from '../../models/IntegrationSyncJob';
import type { IntegrationSyncJobDocument } from '../../types/integration/sync';

const deferGitHubSyncJob = async (
  job: IntegrationSyncJobDocument,
  retryAfterSeconds: number,
): Promise<void> => {
  await IntegrationSyncJob.updateOne(
    { _id: job._id, status: 'running', leaseUntil: job.leaseUntil },
    {
      $set: {
        status: 'queued',
        active: true,
        scheduledAt: new Date(Date.now() + retryAfterSeconds * 1_000),
        leaseUntil: null,
      },
      $inc: { attempts: -1 },
    },
    { runValidators: true },
  );
};

export default deferGitHubSyncJob;
