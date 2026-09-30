import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

import { startPolledQueueWorker } from '../src/workers/polledQueue';
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

test('MongoDB polling runs without RabbitMQ and stops cleanly', async () => {
  let calls = 0;
  const worker = await startPolledQueueWorker({
    broker: null,
    queue: 'test',
    pollIntervalMs: 10,
    processJob: async () => { calls += 1; },
    parseJobId: () => null,
    label: 'test',
  });
  await new Promise((resolve) => setTimeout(resolve, 35));
  assert.ok(calls >= 2);
  await worker.stop();
  const stoppedAt = calls;
  await new Promise((resolve) => setTimeout(resolve, 35));
  assert.equal(calls, stoppedAt);
});

test('delivery waits for an active poll before ack and a new channel can attach after close', async () => {
  let finishPoll: (() => void) | undefined;
  const processed: Array<string | undefined> = [];
  let consumer: ((message: { content: Buffer } | null) => Promise<void>) | undefined;
  const events = new EventEmitter();
  const acks: string[] = [];
  const channel = Object.assign(events, {
    assertQueue: async () => {},
    prefetch: async () => {},
    consume: async (_queue: string, callback: typeof consumer) => {
      consumer = callback;
      return { consumerTag: 'consumer' };
    },
    ack: () => { acks.push('ack'); },
    nack: () => {},
    cancel: async () => {},
    close: async () => { events.emit('close'); },
  });
  const broker = { createConfirmChannel: async () => channel };
  const worker = await startPolledQueueWorker({
    broker: null,
    queue: 'test',
    pollIntervalMs: 1_000_000,
    processJob: async (jobId) => {
      processed.push(jobId);
      if (!jobId) {
        await new Promise<void>((resolve) => { finishPoll = resolve; });
      }
    },
    parseJobId: (message) => message.content.toString(),
    label: 'test',
  });

  try {
    await worker.attachBroker(broker as never);
    const delivery = consumer!({ content: Buffer.from('job-1') });
    await flush();
    assert.deepEqual(processed, [undefined]);
    assert.deepEqual(acks, []);
    finishPoll!();
    await delivery;
    assert.deepEqual(processed, [undefined, 'job-1']);
    assert.deepEqual(acks, ['ack']);

    events.emit('close');
    await worker.attachBroker(broker as never);
  } finally {
    finishPoll?.();
    await worker.stop();
  }
});
