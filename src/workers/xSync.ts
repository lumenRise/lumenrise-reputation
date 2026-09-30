import type { ChannelModel } from 'amqplib';

import parseJobId from './parseJobId';
import processXSyncJob from './x/processXSyncJob';
import { startPolledQueueWorker } from './polledQueue';
const X_SYNC_QUEUE = 'lumenrise.reputation.x-sync.v1';

const startXSyncWorker = async (
  broker: ChannelModel | null,
  pollIntervalMs: number,
) => startPolledQueueWorker({
  broker,
  queue: X_SYNC_QUEUE,
  pollIntervalMs,
  processJob: processXSyncJob,
  parseJobId,
  label: 'X sync',
});

export { X_SYNC_QUEUE, processXSyncJob, startXSyncWorker };
