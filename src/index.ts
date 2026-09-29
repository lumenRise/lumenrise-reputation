import amqp from 'amqplib';
import mongoose from 'mongoose';

import env from './env.js';
import { startGitHubSyncWorker } from './workers/githubSync.js';

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

  let worker;
  try {
    worker = await startGitHubSyncWorker(broker, env.SYNC_WORKER_POLL_INTERVAL_MS);
  } catch (error) {
    await broker.close();
    await mongoose.disconnect();
    throw error;
  }

  console.info('Reputation service started GitHub sync worker.');

  let closing = false;
  const shutdown = async (): Promise<void> => {
    if (closing) return;
    closing = true;

    try {
      await worker.stop();
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
