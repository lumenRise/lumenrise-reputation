import amqp from 'amqplib';
import mongoose from 'mongoose';

import env from './env';
import logEvent from './logEvent';
import { startXSyncWorker } from './workers/xSync';
import type { QueueWorker } from './workers/polledQueue';
import { startRetentionWorker } from './workers/retention';
import { startHealthServer } from './workers/healthServer';
import assertRequiredIndexes from './assertRequiredIndexes';
import { startGitHubSyncWorker } from './workers/githubSync';
import { startStellarScanWorker } from './workers/stellarScan';
import { startSorobanEvidenceWorker } from './workers/sorobanEvidence';
import validateRuntimeConfiguration from './validateRuntimeConfiguration';

const BROKER_RETRY_MS = 5_000;

const main = async (): Promise<void> => {
  validateRuntimeConfiguration(env);
  mongoose.set('autoIndex', false);
  await mongoose.connect(env.DB_URI, {
    dbName: env.DB_NAME,
    serverSelectionTimeoutMS: 5_000,
  });
  try {
    await assertRequiredIndexes();
  } catch (error) {
    await mongoose.disconnect();
    throw error;
  }

  const workers: Array<{ stop: () => Promise<void> }> = [];
  const queueWorkers: QueueWorker[] = [];
  let broker: Awaited<ReturnType<typeof amqp.connect>> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let connecting: Promise<void> | null = null;
  let closing = false;

  const scheduleReconnect = (): void => {
    if (closing || retryTimer) {
      return;
    }
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void connectBroker();
    }, BROKER_RETRY_MS);
  };

  const connectBroker = (): Promise<void> => {
    if (closing || connecting || broker) {
      return connecting ?? Promise.resolve();
    }
    connecting = (async () => {
      let connection: Awaited<ReturnType<typeof amqp.connect>> | null = null;
      try {
        const connected = await amqp.connect(env.RABBITMQ_URL, {
          timeout: 5_000,
        });
        connection = connected;
        connected.on('error', (error) => logEvent('error', 'rabbitmq_connection_error', {
          errorName: error instanceof Error ? error.name : 'UnknownError',
        }));
        connected.on('close', () => {
          if (broker === connected) {
            broker = null;
          }
          scheduleReconnect();
        });
        broker = connected;
        await Promise.all(
          queueWorkers.map((worker) => worker.attachBroker(connected)),
        );
        logEvent('info', 'rabbitmq_consumers_connected');
      } catch (error) {
        logEvent('warn', 'rabbitmq_unavailable_polling_continues', {
          errorName: error instanceof Error ? error.name : 'UnknownError',
        });
        if (broker === connection) {
          broker = null;
        }
        await connection?.close().catch(() => {});
        scheduleReconnect();
      } finally {
        connecting = null;
      }
    })();
    return connecting;
  };

  try {
    queueWorkers.push(
      await startGitHubSyncWorker(null, env.SYNC_WORKER_POLL_INTERVAL_MS),
    );
    queueWorkers.push(
      await startXSyncWorker(null, env.SYNC_WORKER_POLL_INTERVAL_MS),
    );
    queueWorkers.push(
      await startStellarScanWorker(null, env.SYNC_WORKER_POLL_INTERVAL_MS),
    );
    workers.push(...queueWorkers);
    workers.push(startSorobanEvidenceWorker(env.SYNC_WORKER_POLL_INTERVAL_MS));
    workers.push(startRetentionWorker());
    workers.push(await startHealthServer(env.HEALTH_PORT, () => broker !== null));
  } catch (error) {
    await Promise.allSettled(workers.reverse().map((worker) => worker.stop()));
    await mongoose.disconnect();
    throw error;
  }

  logEvent('info', 'mongodb_polling_started');
  void connectBroker();

  const shutdown = async (): Promise<void> => {
    if (closing) {
      return;
    }
    closing = true;
    if (retryTimer) {
      clearTimeout(retryTimer);
    }
    try {
      await connecting;
      await Promise.allSettled(
        workers.reverse().map((worker) => worker.stop()),
      );
      await broker?.close().catch(() => {});
      await mongoose.disconnect();
    } catch (error) {
      logEvent('error', 'shutdown_failed', {
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
      process.exitCode = 1;
    }
  };

  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
};

void main().catch((error: unknown) => {
  logEvent('error', 'startup_failed', {
    errorName: error instanceof Error ? error.name : 'UnknownError',
    reason: error instanceof Error && /^(SYNC_|X_AUTO_|GITHUB_|X_CLIENT_|CREDENTIAL_|STELLAR_|HEALTH_)/.test(error.message)
      ? error.message : null,
  });
  process.exitCode = 1;
});
