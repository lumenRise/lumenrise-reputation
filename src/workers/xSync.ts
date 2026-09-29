import type { ChannelModel, ConfirmChannel } from 'amqplib';

import ExternalAccount from '../models/ExternalAccount.js';
import IntegrationSyncJob from '../models/IntegrationSyncJob.js';
import XRateLimitError from '../services/integration/xRateLimit.js';
import XApiResponseError from '../services/integration/xApiResponseError.js';
import { syncXAccount } from '../services/integration/xSync.js';
import type { IntegrationSyncJobDocument } from '../types/integration/sync.js';
import { claimIntegrationSyncJob } from '../utils/services/integration/syncQueue/claimIntegrationSyncJob.js';
import { completeIntegrationSyncJob } from '../utils/services/integration/syncQueue/completeIntegrationSyncJob.js';
import { failIntegrationSyncJob } from '../utils/services/integration/syncQueue/failIntegrationSyncJob.js';
import { parseJobId } from './githubSync.js';

const X_SYNC_QUEUE = 'lumenrise.reputation.x-sync.v1';

const deferXSyncJob = async (
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

const processXSyncJob = async (jobId?: string): Promise<void> => {
  const job = await claimIntegrationSyncJob(jobId);
  if (!job) return;

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
    const reason = error instanceof Error ? error.message : String(error);
    await failIntegrationSyncJob(job, reason, retryable);
    console.warn('X synchronization failed', { jobId: job._id, error });
  }
};

const startXSyncWorker = async (
  broker: ChannelModel,
  pollIntervalMs: number,
): Promise<{ stop: () => Promise<void> }> => {
  const channel: ConfirmChannel = await broker.createConfirmChannel();
  await channel.assertQueue(X_SYNC_QUEUE, { durable: true });
  await channel.prefetch(1);

  let activeTick: Promise<void> | null = null;
  const run = (jobId?: string): Promise<void> => {
    if (activeTick) return Promise.resolve();
    activeTick = processXSyncJob(jobId).finally(() => { activeTick = null; });
    return activeTick;
  };

  const consumer = await channel.consume(X_SYNC_QUEUE, async (message) => {
    if (!message) return;
    const jobId = parseJobId(message);
    if (!jobId) {
      channel.nack(message, false, false);
      return;
    }
    try {
      await run(jobId);
    } catch (error) {
      console.error('X sync command failed; MongoDB job remains available for retry', error);
    } finally {
      channel.ack(message);
    }
  });

  const timer = setInterval(() => {
    void run().catch((error: unknown) => console.error('X sync reconciliation failed', error));
  }, pollIntervalMs);
  void run().catch((error: unknown) => console.error('X sync reconciliation failed', error));

  return {
    stop: async () => {
      clearInterval(timer);
      await channel.cancel(consumer.consumerTag);
      await activeTick;
      await channel.close();
    },
  };
};

export { X_SYNC_QUEUE, processXSyncJob, startXSyncWorker };
