import type { ChannelModel } from 'amqplib';

import parseJobId from './parseJobId';
import type { QueueWorker } from './polledQueue';
import { startPolledQueueWorker } from './polledQueue';
import processConnectionCleanup from './processConnectionCleanup';

const startConnectionCleanupWorker = async (broker: ChannelModel | null): Promise<QueueWorker> => {
  return startPolledQueueWorker({
    broker,
    queue: 'lumenrise.reputation.connection-cleanup.v1',
    pollIntervalMs: 2000,
    parseJobId,
    processJob: processConnectionCleanup,
    label: 'Reputation connection cleanup',
  });
};

export default startConnectionCleanupWorker;
