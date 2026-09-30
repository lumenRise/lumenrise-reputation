import { randomUUID } from 'node:crypto';
import mongoose, { Types } from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { claimGitHubSyncJob } from '../../src/workers/githubSync';
import IntegrationSyncJob from '../../src/models/IntegrationSyncJob';
import StellarActivityScan from '../../src/models/StellarActivityScan';
import SorobanTransactionEvidence from '../../src/models/SorobanTransactionEvidence';
import claimSorobanEvidence from '../../src/utils/services/stellar/sorobanEvidenceWorker/claimSorobanEvidence';
import { claimIntegrationSyncJob } from '../../src/utils/services/integration/syncQueue/claimIntegrationSyncJob';
import { claimStellarActivityScan } from '../../src/utils/services/stellar/activityScanQueue/claimStellarActivityScan';

const databaseName = `lumenrise_retry_leases_${randomUUID().replaceAll('-', '')}`;

describe.runIf(Boolean(process.env.LUMENRISE_TEST_DB_URI))('expired worker leases', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.LUMENRISE_TEST_DB_URI!, {
      dbName: databaseName,
      serverSelectionTimeoutMS: 5_000,
    });
    await Promise.all([
      IntegrationSyncJob.createIndexes(),
      StellarActivityScan.createIndexes(),
      SorobanTransactionEvidence.createIndexes(),
    ]);
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
    }
    await mongoose.disconnect();
  });

  it('fails GitHub and X jobs that crashed on their last permitted attempt', async () => {
    const now = new Date();
    for (const provider of ['github', 'x'] as const) {
      const id = new Types.ObjectId();
      await IntegrationSyncJob.collection.insertOne({
        _id: id,
        identity: new Types.ObjectId(),
        externalAccount: new Types.ObjectId(),
        provider,
        status: 'running',
        active: true,
        attempts: 5,
        maxAttempts: 5,
        scheduledAt: new Date(now.getTime() - 60_000),
        leaseUntil: new Date(now.getTime() - 1_000),
        startedAt: new Date(now.getTime() - 60_000),
      });
      const claimed = provider === 'github'
        ? await claimGitHubSyncJob(id.toString(), now)
        : await claimIntegrationSyncJob(id.toString(), now);
      expect(claimed).toBeNull();
      expect(await IntegrationSyncJob.findById(id)).toMatchObject({
        status: 'failed', active: false, attempts: 5,
      });
    }
  });

  it('stops an exhausted Stellar scan and Soroban lookup', async () => {
    const now = new Date();
    const identity = new Types.ObjectId();
    const scanId = new Types.ObjectId();
    await StellarActivityScan.collection.insertOne({
      _id: scanId,
      identity,
      status: 'running',
      active: true,
      consecutiveFailures: 4,
      scheduledAt: new Date(now.getTime() - 60_000),
      leaseUntil: new Date(now.getTime() - 1_000),
    });
    expect(await claimStellarActivityScan(scanId.toString(), now)).toBeNull();
    expect(await StellarActivityScan.findById(scanId)).toMatchObject({ status: 'failed', active: false });

    const evidenceId = new Types.ObjectId();
    await SorobanTransactionEvidence.collection.insertOne({
      _id: evidenceId,
      scan: scanId,
      rpcStatus: 'running',
      attempts: 3,
      scheduledAt: new Date(now.getTime() - 60_000),
      leaseUntil: new Date(now.getTime() - 1_000),
    });
    expect(await claimSorobanEvidence()).toBeNull();
    expect(await SorobanTransactionEvidence.findById(evidenceId)).toMatchObject({
      rpcStatus: 'unavailable', attempts: 3,
    });
  });
});
