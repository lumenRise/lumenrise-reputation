import logEvent from '../../logEvent';
import failGitHubSyncJob from './failGitHubSyncJob';
import claimGitHubSyncJob from './claimGitHubSyncJob';
import deferGitHubSyncJob from './deferGitHubSyncJob';
import ExternalAccount from '../../models/ExternalAccount';
import completeGitHubSyncJob from './completeGitHubSyncJob';
import { syncGitHubAccount } from '../../services/integration/githubSync';

const processGitHubSyncJob = async (jobId?: string): Promise<void> => {
  const job = await claimGitHubSyncJob(jobId);
  if (!job) {
    return;
  }

  try {
    const account = await ExternalAccount.findOne({
      _id: job.externalAccount,
      identity: job.identity,
      provider: 'github',
      status: 'connected',
    });

    if (!account) {
      await failGitHubSyncJob(job, 'Connected GitHub account was not found', false);
      return;
    }

    const outcome = await syncGitHubAccount(account);
    if (outcome.state === 'synchronized') {
      await completeGitHubSyncJob(job, outcome.snapshot._id);
    } else if (outcome.state === 'reauthorization_required') {
      await failGitHubSyncJob(job, 'GitHub account must be reauthorized', false);
    } else if (outcome.state === 'disconnected') {
      await failGitHubSyncJob(job, 'GitHub account was disconnected during synchronization', false);
    } else {
      await deferGitHubSyncJob(job, outcome.retryAfterSeconds);
    }
  } catch (error) {
    const reason = error instanceof Error ? error.name : 'UnknownError';
    await failGitHubSyncJob(job, reason, true);
    logEvent('error', 'github_sync_failed', {
      jobId: job._id.toString(),
      identityId: job.identity.toString(),
      provider: 'github',
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
  }
};

export default processGitHubSyncJob;
