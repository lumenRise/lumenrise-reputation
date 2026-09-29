import type { ChannelModel, ConfirmChannel, ConsumeMessage } from 'amqplib';
import { Types } from 'mongoose';

import ExternalAccount from '../models/ExternalAccount.js';
import IntegrationSyncJob from '../models/IntegrationSyncJob.js';
import { syncGitHubAccount } from '../services/integration/githubSync.js';
import type { IntegrationSyncJobDocument } from '../types/integration/sync.js';
import { GITHUB_SYNC_QUEUE } from '../constants/services/integration/githubSyncQueue.js';

const SYNC_JOB_LEASE_MS = 3_600_000;

const retryDelay = (attempts: number): number =>
  Math.min(60_000 * 2 ** Math.max(0, attempts - 1), 3_600_000);

const claimGitHubSyncJob = async (
  jobId?: string,
  now = new Date(),
): Promise<IntegrationSyncJobDocument | null> =>
  IntegrationSyncJob.findOneAndUpdate(
    {
      ...(jobId ? { _id: new Types.ObjectId(jobId) } : {}),
      provider: 'github',
      active: true,
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

const completeGitHubSyncJob = async (
  job: IntegrationSyncJobDocument,
  snapshotId: Types.ObjectId,
): Promise<void> => {
  await IntegrationSyncJob.updateOne(
    { _id: job._id, status: 'running', leaseUntil: job.leaseUntil },
    {
      $set: {
        status: 'completed',
        active: false,
        completedAt: new Date(),
        leaseUntil: null,
        resultSnapshot: snapshotId,
      },
    },
    { runValidators: true },
  );
};

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
        scheduledAt: shouldRetry ? new Date(Date.now() + retryDelay(job.attempts)) : job.scheduledAt,
        completedAt: shouldRetry ? null : new Date(),
        leaseUntil: null,
        lastError: reason.slice(0, 2_000),
      },
    },
    { runValidators: true },
  );
};

const processGitHubSyncJob = async (jobId?: string): Promise<void> => {
  const job = await claimGitHubSyncJob(jobId);
  if (!job) return;

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
    } else {
      await deferGitHubSyncJob(job, outcome.retryAfterSeconds);
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await failGitHubSyncJob(job, reason, true);
    console.error('GitHub synchronization failed', error);
  }
};

const parseJobId = (message: ConsumeMessage): string | null => {
  try {
    const payload: unknown = JSON.parse(message.content.toString('utf8'));
    if (typeof payload !== 'object' || payload === null) return null;
    const jobId = Reflect.get(payload, 'jobId');
    return typeof jobId === 'string' && Types.ObjectId.isValid(jobId) ? jobId : null;
  } catch {
    return null;
  }
};

const startGitHubSyncWorker = async (
  broker: ChannelModel,
  pollIntervalMs: number,
): Promise<{ stop: () => Promise<void> }> => {
  const channel: ConfirmChannel = await broker.createConfirmChannel();
  await channel.assertQueue(GITHUB_SYNC_QUEUE, { durable: true });
  await channel.prefetch(1);

  let activeTick: Promise<void> | null = null;
  const run = (jobId?: string): Promise<void> => {
    if (activeTick) return Promise.resolve();
    activeTick = processGitHubSyncJob(jobId).finally(() => { activeTick = null; });
    return activeTick;
  };

  const consumer = await channel.consume(GITHUB_SYNC_QUEUE, async (message) => {
    if (!message) return;
    const jobId = parseJobId(message);
    if (!jobId) {
      channel.nack(message, false, false);
      return;
    }
    try {
      await run(jobId);
    } catch (error) {
      console.error('GitHub sync command failed; MongoDB job remains available for retry', error);
    } finally {
      channel.ack(message);
    }
  });

  const timer = setInterval(() => {
    void run().catch((error: unknown) => console.error('GitHub sync reconciliation failed', error));
  }, pollIntervalMs);
  void run().catch((error: unknown) => console.error('GitHub sync reconciliation failed', error));

  return {
    stop: async () => {
      clearInterval(timer);
      await channel.cancel(consumer.consumerTag);
      await activeTick;
      await channel.close();
    },
  };
};

export { claimGitHubSyncJob, parseJobId, processGitHubSyncJob, startGitHubSyncWorker };
