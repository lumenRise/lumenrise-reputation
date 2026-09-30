import amqp from 'amqplib';
import test from 'node:test';
import mongoose from 'mongoose';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { Keypair } from '@stellar/stellar-sdk';
import { createHash, randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';

import waitFor from './waitFor';
import stopChild from './stopChild';
import getFreePort from './getFreePort';
import Identity from '../../src/models/Identity';
import StellarAccount from '../../src/models/StellarAccount';

test('API and Reputation complete a Stellar scan with or without RabbitMQ', {
  skip: !process.env.LUMENRISE_TEST_RABBITMQ_URL,
}, async () => {
  const apiPath = process.env.LUMENRISE_API_PATH;
  const brokerUnavailable = process.env.LUMENRISE_TEST_BROKER_OUTAGE === '1';
  if (!apiPath) {
    throw new Error('LUMENRISE_API_PATH is required');
  }
  const databaseUri = process.env.LUMENRISE_TEST_DB_URI;
  if (!databaseUri) {
    throw new Error('LUMENRISE_TEST_DB_URI is required');
  }

  const apiPort = await getFreePort();
  const healthPort = await getFreePort();
  const address = Keypair.random().publicKey();
  const horizon: Server = createServer((request, response) => {
    const cursor = new URL(request.url ?? '/', 'http://127.0.0.1').searchParams.get('cursor');
    const records = cursor ? [] : Array.from({ length: 200 }, (_, index) => ({
      id: String(200 - index),
      paging_token: String(200 - index),
      type: 'manage_buy_offer',
      type_i: 12,
      created_at: '2026-09-30T12:00:00Z',
      transaction_hash: (200 - index).toString(16).padStart(64, '0'),
      source_account: address,
      transaction_successful: true,
    }));
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ _embedded: { records } }));
  });
  await new Promise<void>((resolve) => horizon.listen(0, '127.0.0.1', resolve));
  const addressInfo = horizon.address();
  if (!addressInfo || typeof addressInfo === 'string') {
    throw new Error('Could not start fake Horizon');
  }
  const horizonUrl = `http://127.0.0.1:${addressInfo.port}`;
  const apiUrl = `http://127.0.0.1:${apiPort}`;
  const environment = {
    ...process.env,
    NODE_ENV: 'test',
    PORT: apiPort.toString(),
    HEALTH_PORT: healthPort.toString(),
    DB_URI: databaseUri,
    DB_NAME: process.env.DB_NAME ?? 'lumenrise_integration_test',
    RABBITMQ_URL: process.env.LUMENRISE_TEST_RABBITMQ_URL,
    STELLAR_HORIZON_URL: horizonUrl,
    CREDENTIAL_ENCRYPTION_KEY: '0'.repeat(64),
  };
  const children: ChildProcess[] = [];
  let broker: Awaited<ReturnType<typeof amqp.connect>> | null = null;
  let channel: Awaited<ReturnType<NonNullable<typeof broker>['createChannel']>> | null = null;
  try {
    await mongoose.connect(databaseUri, { dbName: environment.DB_NAME });
    const identity = await Identity.create({ name: 'Two-service test' });
    await StellarAccount.create({
      identity: identity._id,
      address,
      isPrimary: true,
      connectedAt: new Date(),
    });
    const token = randomUUID();
    await mongoose.connection.collection('sessions').insertOne({
      identity: identity._id,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      expiresAt: new Date(Date.now() + 60_000),
      lastSeenAt: new Date(),
      revokedAt: null,
    });

    const api = spawn(process.execPath, [resolve(apiPath, 'dist/index.js')], {
      cwd: apiPath,
      env: environment,
      stdio: 'inherit',
    });
    children.push(api);
    await waitFor(async () => {
      try {
        return (await fetch(`${apiUrl}/v1/health`)).ok;
      } catch {
        return false;
      }
    });

    const scanUrl = `${apiUrl}/v1/stellar/accounts/${address}/activity-scan`;
    const cookie = { Cookie: `lumenrise_session=${token}` };
    const created = await fetch(scanUrl, { method: 'POST', headers: cookie });
    assert.equal(created.status, 202);
    const createdBody = await created.json() as { result: { id: string } };
    assert.ok(createdBody.result.id);

    if (!brokerUnavailable) {
      broker = await amqp.connect(process.env.LUMENRISE_TEST_RABBITMQ_URL!);
      channel = await broker.createChannel();
      const queued = await channel.checkQueue('lumenrise.reputation.stellar-scan.v1');
      assert.ok(queued.messageCount >= 1, 'API must publish a RabbitMQ message');
    }

    const worker = spawn(process.execPath, [resolve('dist/index.js')], {
      cwd: resolve('.'),
      env: environment,
      stdio: 'inherit',
    });
    children.push(worker);
    if (brokerUnavailable) {
      await waitFor(async () => {
        try {
          const response = await fetch(`http://127.0.0.1:${healthPort}/ready`);
          const state = await response.json() as { mongoReady: boolean; rabbitmqReady: boolean };
          return state.mongoReady && !state.rabbitmqReady;
        } catch {
          return false;
        }
      });
    }
    await waitFor(async () => {
      const response = await fetch(scanUrl, { headers: cookie });
      if (!response.ok) {
        return false;
      }
      const body = await response.json() as { result: { status: string } };
      return body.result.status === 'completed';
    });

    const stored = await mongoose.connection.collection('stellaractivityscans').findOne({
      _id: new mongoose.Types.ObjectId(createdBody.result.id),
      identity: identity._id,
    });
    assert.equal(stored?.status, 'completed');
    assert.equal(stored?.pagesProcessed, 2);
    const score = await fetch(`${apiUrl}/v1/stellar/accounts/${address}/activity-score`, {
      headers: cookie,
    });
    assert.equal(score.status, 200);
    const scoreBody = await score.json() as { result: {
      address: string;
      ownershipVerified: boolean;
      pagesProcessed: number;
      score: number;
    } };
    assert.equal(scoreBody.result.address, address);
    assert.equal(scoreBody.result.ownershipVerified, false);
    assert.equal(scoreBody.result.pagesProcessed, 2);
    assert.ok(scoreBody.result.score > 0);

    const profile = await fetch(`${apiUrl}/v1/reputation/profile`, { headers: cookie });
    assert.equal(profile.status, 200);
    const profileBody = await profile.json() as { result: {
      identity: { primaryWalletAddress: string };
      stellar: { ownershipVerified: boolean; score: { scanId: string; score: number } };
    } };
    assert.equal(profileBody.result.identity.primaryWalletAddress, address);
    assert.equal(profileBody.result.stellar.ownershipVerified, true);
    assert.equal(profileBody.result.stellar.score.scanId, createdBody.result.id);
    assert.equal(profileBody.result.stellar.score.score, scoreBody.result.score);

    const policyKey = `stellar-${randomUUID().slice(0, 8)}`;
    const policy = await fetch(`${apiUrl}/v1/policies`, {
      method: 'POST',
      headers: { ...cookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        key: policyKey,
        version: 1,
        match: 'all',
        rules: [{ dimension: 'stellar', minScore: 0, maxAgeSeconds: 86_400 }],
      }),
    });
    assert.equal(policy.status, 201);
    const evaluation = await fetch(`${apiUrl}/v1/policies/${policyKey}/evaluate`, {
      method: 'POST',
      headers: cookie,
    });
    assert.equal(evaluation.status, 200);
    const evaluationBody = await evaluation.json() as { result: { decision: string } };
    assert.equal(evaluationBody.result.decision, 'eligible');
  } finally {
    for (const child of children.reverse()) {
      await stopChild(child);
    }
    await channel?.close().catch(() => {});
    await broker?.close().catch(() => {});
    await mongoose.disconnect();
    await new Promise<void>((resolve) => horizon.close(() => resolve()));
  }
});
