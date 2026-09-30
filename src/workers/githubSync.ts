import type { ChannelModel } from 'amqplib';

import parseJobId from './parseJobId';
import { startPolledQueueWorker } from './polledQueue';
import claimGitHubSyncJob from './github/claimGitHubSyncJob';
import processGitHubSyncJob from './github/processGitHubSyncJob';
import { GITHUB_SYNC_QUEUE } from '../constants/services/integration/githubSyncQueue';

const startGitHubSyncWorker = async (
  broker: ChannelModel | null,
  pollIntervalMs: number,
) => startPolledQueueWorker({
  broker,
  queue: GITHUB_SYNC_QUEUE,
  pollIntervalMs,
  processJob: processGitHubSyncJob,
  parseJobId,
  label: 'GitHub sync',
});

export { claimGitHubSyncJob, parseJobId, processGitHubSyncJob, startGitHubSyncWorker };
