import assert from 'node:assert/strict';
import test from 'node:test';

import { Types } from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.DB_URI = 'mongodb://127.0.0.1:27017';
process.env.DB_NAME = 'lumenrise_test';
process.env.RABBITMQ_URL = 'amqp://127.0.0.1:5672';
process.env.CREDENTIAL_ENCRYPTION_KEY = '0'.repeat(64);

const IntegrationSyncJob = (await import('../src/models/IntegrationSyncJob.js')).default;
const { claimGitHubSyncJob, parseJobId } = await import('../src/workers/githubSync.js');

test('worker accepts only valid GitHub job IDs from RabbitMQ', () => {
  const id = new Types.ObjectId().toString();
  const message = (payload: string) => ({ content: Buffer.from(payload) }) as never;

  assert.equal(parseJobId(message(JSON.stringify({ jobId: id }))), id);
  assert.equal(parseJobId(message('{invalid')), null);
  assert.equal(parseJobId(message(JSON.stringify({ jobId: 'invalid' }))), null);
});

test('worker claims GitHub jobs only', async () => {
  const original = IntegrationSyncJob.findOneAndUpdate;
  let filter: unknown;
  IntegrationSyncJob.findOneAndUpdate = ((received: unknown) => {
    filter = received;
    return Promise.resolve(null);
  }) as typeof original;

  try {
    await claimGitHubSyncJob();
    assert.equal((filter as { provider: string }).provider, 'github');
  } finally {
    IntegrationSyncJob.findOneAndUpdate = original;
  }
});
