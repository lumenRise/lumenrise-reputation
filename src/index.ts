import amqp from 'amqplib';
import mongoose from 'mongoose';

import env from './env.js';
import { startGitHubSyncWorker } from './workers/githubSync.js';
import { startXSyncWorker } from './workers/xSync.js';
import { startStellarScanWorker } from './workers/stellarScan.js';
import { startSorobanEvidenceWorker } from './workers/sorobanEvidence.js';
import { startXScheduler } from './workers/xScheduler.js';

const main = async (): Promise<void> => {
  mongoose.set('autoIndex', false);

  await mongoose.connect(env.DB_URI, {
    dbName: env.DB_NAME,
    serverSelectionTimeoutMS: 5_000,
  });

  let broker: Awaited<ReturnType<typeof amqp.connect>>;

  try {
    broker = await amqp.connect(env.RABBITMQ_URL);
  } catch (error) {
    await mongoose.disconnect();
    throw error;
  }

  const workers: Array<{ stop: () => Promise<void> }> = [];
  try {
    workers.push(await startGitHubSyncWorker(broker, env.SYNC_WORKER_POLL_INTERVAL_MS));
    workers.push(await startXSyncWorker(broker, env.SYNC_WORKER_POLL_INTERVAL_MS));
    workers.push(await startStellarScanWorker(broker, env.SYNC_WORKER_POLL_INTERVAL_MS));
    workers.push(startSorobanEvidenceWorker(env.SYNC_WORKER_POLL_INTERVAL_MS));
    workers.push(startXScheduler());
  } catch (error) {
    await Promise.allSettled(workers.reverse().map((worker) => worker.stop()));
    await broker.close();
    await mongoose.disconnect();
    throw error;
  }

  console.info('Reputation service started GitHub, X, Stellar and Soroban workers.');

  let closing = false;
  const shutdown = async (): Promise<void> => {
    if (closing) return;
    closing = true;

    try {
      await Promise.all(workers.reverse().map((worker) => worker.stop()));
      await broker.close();
      await mongoose.disconnect();
    } catch (error) {
      console.error('Reputation service shutdown failed', error);
      process.exitCode = 1;
    }
  };

  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
};

void main().catch((error: unknown) => {
  console.error('Reputation service failed to start', error);
  process.exitCode = 1;
});
