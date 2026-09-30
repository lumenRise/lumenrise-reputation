import type { ChannelModel } from 'amqplib';

import parseJobId from './parseJobId';
import { startPolledQueueWorker } from './polledQueue';
import processStellarScanJob from './stellar/processStellarScanJob';
const STELLAR_SCAN_QUEUE = 'lumenrise.reputation.stellar-scan.v1';

const startStellarScanWorker = (broker: ChannelModel | null, pollIntervalMs: number) =>
  startPolledQueueWorker({
    broker,
    queue: STELLAR_SCAN_QUEUE,
    pollIntervalMs,
    processJob: processStellarScanJob,
    parseJobId,
    label: 'Stellar scan',
  });

export { STELLAR_SCAN_QUEUE, processStellarScanJob, startStellarScanWorker };
