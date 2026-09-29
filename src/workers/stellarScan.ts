import type { ChannelModel } from 'amqplib';

import { claimStellarActivityScan } from '../utils/services/stellar/activityScanQueue/claimStellarActivityScan.js';
import { processStellarActivityScan } from '../utils/services/stellar/activityScanWorker/processStellarActivityScan.js';
import { parseJobId } from './githubSync.js';

const STELLAR_SCAN_QUEUE = 'lumenrise.reputation.stellar-scan.v1';

const processStellarScanJob = async (scanId?: string): Promise<void> => {
  const scan = await claimStellarActivityScan(scanId);
  if (scan) await processStellarActivityScan(scan);
};

const startStellarScanWorker = async (broker: ChannelModel, pollIntervalMs: number) => {
  const channel = await broker.createConfirmChannel();
  await channel.assertQueue(STELLAR_SCAN_QUEUE, { durable: true });
  await channel.prefetch(1);

  let activeTick: Promise<void> | null = null;
  const run = (scanId?: string): Promise<void> => {
    if (activeTick) return Promise.resolve();
    activeTick = processStellarScanJob(scanId).finally(() => { activeTick = null; });
    return activeTick;
  };

  const consumer = await channel.consume(STELLAR_SCAN_QUEUE, async (message) => {
    if (!message) return;
    const scanId = parseJobId(message);
    if (!scanId) {
      channel.nack(message, false, false);
      return;
    }
    try {
      await run(scanId);
    } catch (error) {
      console.error('Stellar scan command failed; MongoDB job remains available for retry', error);
    } finally {
      channel.ack(message);
    }
  });

  const timer = setInterval(() => {
    void run().catch((error: unknown) => console.error('Stellar scan reconciliation failed', error));
  }, pollIntervalMs);
  void run().catch((error: unknown) => console.error('Stellar scan reconciliation failed', error));

  return {
    stop: async (): Promise<void> => {
      clearInterval(timer);
      await channel.cancel(consumer.consumerTag);
      await activeTick;
      await channel.close();
    },
  };
};

export { STELLAR_SCAN_QUEUE, processStellarScanJob, startStellarScanWorker };
