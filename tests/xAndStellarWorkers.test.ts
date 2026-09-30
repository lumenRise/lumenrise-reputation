import test from 'node:test';
import { Types } from 'mongoose';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.DB_URI = 'mongodb://127.0.0.1:27017';
process.env.DB_NAME = 'lumenrise_test';
process.env.RABBITMQ_URL = 'amqp://127.0.0.1:5672';
process.env.CREDENTIAL_ENCRYPTION_KEY = '0'.repeat(64);

const IntegrationSyncJob = (await import('../src/models/IntegrationSyncJob')).default;
const StellarActivityScan = (await import('../src/models/StellarActivityScan')).default;
const { claimIntegrationSyncJob } = await import('../src/utils/services/integration/syncQueue/claimIntegrationSyncJob');
const { claimStellarActivityScan } = await import('../src/utils/services/stellar/activityScanQueue/claimStellarActivityScan');
const { startXSyncWorker, X_SYNC_QUEUE } = await import('../src/workers/xSync');
const { startStellarScanWorker, STELLAR_SCAN_QUEUE } = await import('../src/workers/stellarScan');

test('X worker claims only X jobs and accepts a specific job ID', async () => {
  const original = IntegrationSyncJob.findOneAndUpdate;
  const originalUpdateMany = IntegrationSyncJob.updateMany;
  IntegrationSyncJob.updateMany = (() => Promise.resolve({ modifiedCount: 0 })) as typeof originalUpdateMany;
  let filter: unknown;
  IntegrationSyncJob.findOneAndUpdate = ((received: unknown) => {
    filter = received;
    return Promise.resolve(null);
  }) as typeof original;

  try {
    const id = new Types.ObjectId();
    await claimIntegrationSyncJob(id.toString());
    assert.equal((filter as { provider: string }).provider, 'x');
    assert.deepEqual((filter as { _id: Types.ObjectId })._id, id);
  } finally {
    IntegrationSyncJob.findOneAndUpdate = original;
    IntegrationSyncJob.updateMany = originalUpdateMany;
  }
});

test('Stellar worker claims a specific due scan', async () => {
  const original = StellarActivityScan.findOneAndUpdate;
  const originalUpdateMany = StellarActivityScan.updateMany;
  StellarActivityScan.updateMany = (() => Promise.resolve({ modifiedCount: 0 })) as typeof originalUpdateMany;
  let filter: unknown;
  StellarActivityScan.findOneAndUpdate = ((received: unknown) => {
    filter = received;
    return Promise.resolve(null);
  }) as typeof original;

  try {
    const id = new Types.ObjectId();
    await claimStellarActivityScan(id.toString());
    assert.deepEqual((filter as { _id: Types.ObjectId })._id, id);
    assert.equal((filter as { active: boolean }).active, true);
  } finally {
    StellarActivityScan.findOneAndUpdate = original;
    StellarActivityScan.updateMany = originalUpdateMany;
  }
});

test('X and Stellar workers declare durable RabbitMQ queues', async () => {
  const originalX = IntegrationSyncJob.findOneAndUpdate;
  const originalStellar = StellarActivityScan.findOneAndUpdate;
  const originalXUpdateMany = IntegrationSyncJob.updateMany;
  const originalStellarUpdateMany = StellarActivityScan.updateMany;
  IntegrationSyncJob.updateMany = (() => Promise.resolve({ modifiedCount: 0 })) as typeof originalXUpdateMany;
  StellarActivityScan.updateMany = (() => Promise.resolve({ modifiedCount: 0 })) as typeof originalStellarUpdateMany;
  IntegrationSyncJob.findOneAndUpdate = (() => Promise.resolve(null)) as typeof originalX;
  StellarActivityScan.findOneAndUpdate = (() => Promise.resolve(null)) as typeof originalStellar;
  const declared: Array<{ name: string; durable: boolean }> = [];
  const channel = {
    assertQueue: async (name: string, options: { durable: boolean }) => {
      declared.push({ name, durable: options.durable });
    },
    prefetch: async () => {},
    consume: async () => ({ consumerTag: 'test' }),
    cancel: async () => {},
    close: async () => {},
  };
  const broker = { createConfirmChannel: async () => channel };

  try {
    const x = await startXSyncWorker(broker as never, 1_000_000);
    const stellar = await startStellarScanWorker(broker as never, 1_000_000);
    assert.deepEqual(declared, [
      { name: X_SYNC_QUEUE, durable: true },
      { name: STELLAR_SCAN_QUEUE, durable: true },
    ]);
    await stellar.stop();
    await x.stop();
  } finally {
    IntegrationSyncJob.findOneAndUpdate = originalX;
    StellarActivityScan.findOneAndUpdate = originalStellar;
    IntegrationSyncJob.updateMany = originalXUpdateMany;
    StellarActivityScan.updateMany = originalStellarUpdateMany;
  }
});
