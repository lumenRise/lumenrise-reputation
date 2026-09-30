import logEvent from '../../logEvent';
import deferXSyncJob from './deferXSyncJob';
import ExternalAccount from '../../models/ExternalAccount';
import { syncXAccount } from '../../services/integration/xSync';
import XRateLimitError from '../../services/integration/xRateLimit';
import XApiResponseError from '../../services/integration/xApiResponseError';
import { failIntegrationSyncJob } from '../../utils/services/integration/syncQueue/failIntegrationSyncJob';
import { claimIntegrationSyncJob } from '../../utils/services/integration/syncQueue/claimIntegrationSyncJob';
import { completeIntegrationSyncJob } from '../../utils/services/integration/syncQueue/completeIntegrationSyncJob';

const processXSyncJob = async (jobId?: string): Promise<void> => {
  const job = await claimIntegrationSyncJob(jobId);
  if (!job) {
    return;
  }

  try {
    const account = await ExternalAccount.findOne({
      _id: job.externalAccount,
      identity: job.identity,
      provider: 'x',
      status: 'connected',
    });

    if (!account) {
      await failIntegrationSyncJob(job, 'Connected X account was not found', false);
      return;
    }

    const outcome = await syncXAccount(account);
    if (outcome.state === 'synchronized') {
      await completeIntegrationSyncJob(job, outcome.snapshot._id);
    } else if (outcome.state === 'reauthorization_required') {
      await failIntegrationSyncJob(job, 'X account must be reauthorized', false);
    } else if (outcome.state === 'disconnected') {
      await failIntegrationSyncJob(job, 'X account was disconnected during synchronization', false);
    } else {
      await deferXSyncJob(job, outcome.retryAfterSeconds);
    }
  } catch (error) {
    if (error instanceof XRateLimitError) {
      await deferXSyncJob(job, error.retryAfterSeconds);
      return;
    }
    const retryable = error instanceof XApiResponseError ? error.retryable : true;
    const reason = error instanceof XApiResponseError
      ? `X API request failed with status ${error.status}`
      : error instanceof Error ? error.name : 'UnknownError';
    await failIntegrationSyncJob(job, reason, retryable);
    logEvent('warn', 'x_sync_failed', {
      jobId: job._id.toString(),
      identityId: job.identity.toString(),
      provider: 'x',
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
  }
};

export default processXSyncJob;
