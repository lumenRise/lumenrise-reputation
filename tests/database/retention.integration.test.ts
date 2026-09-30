import { randomUUID } from 'node:crypto';
import mongoose, { Types } from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import XDataSnapshot from '../../src/models/XDataSnapshot';
import IntegrationSyncJob from '../../src/models/IntegrationSyncJob';
import ReputationSnapshot from '../../src/models/ReputationSnapshot';
import StellarPaymentFact from '../../src/models/StellarPaymentFact';
import GitHubDataSnapshot from '../../src/models/GitHubDataSnapshot';
import StellarActivityScan from '../../src/models/StellarActivityScan';
import GitHubRepositoryFact from '../../src/models/GitHubRepositoryFact';
import SorobanTransactionEvidence from '../../src/models/SorobanTransactionEvidence';
import purgeExpiredXSnapshots from '../../src/services/retention/purgeExpiredXSnapshots';
import trimStellarScanHistory from '../../src/services/retention/trimStellarScanHistory';
import purgeExpiredGitHubSnapshots from '../../src/services/retention/purgeExpiredGitHubSnapshots';

const databaseName = `lumenrise_retention_${randomUUID().replaceAll('-', '')}`;

describe.runIf(Boolean(process.env.LUMENRISE_TEST_DB_URI))('retention cleanup', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.LUMENRISE_TEST_DB_URI!, {
      dbName: databaseName,
      serverSelectionTimeoutMS: 5_000,
    });
    await Promise.all([
      XDataSnapshot.createIndexes(),
      IntegrationSyncJob.createIndexes(),
      ReputationSnapshot.createIndexes(),
      StellarPaymentFact.createIndexes(),
      StellarActivityScan.createIndexes(),
      GitHubDataSnapshot.createIndexes(),
      GitHubRepositoryFact.createIndexes(),
      SorobanTransactionEvidence.createIndexes(),
    ]);
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
    }
    await mongoose.disconnect();
  });

  it('removes expired provider data and clears job references in the same transaction', async () => {
    const identity = new Types.ObjectId();
    const old = new Date(Date.now() - 100 * 24 * 60 * 60 * 1_000);
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1_000);
    for (const [Data, provider, category] of [
      [GitHubDataSnapshot, 'github', 'developer'],
      [XDataSnapshot, 'x', 'social'],
    ] as const) {
      const snapshot = new Types.ObjectId();
      await Data.collection.insertOne({ _id: snapshot, identity, collectedAt: old });
      await ReputationSnapshot.collection.insertOne({
        identity,
        category,
        sources: [{ provider, snapshot }],
        calculatedAt: old,
      });
      await IntegrationSyncJob.collection.insertOne({
        identity,
        externalAccount: new Types.ObjectId(),
        provider,
        status: 'completed',
        active: false,
        resultSnapshot: snapshot,
      });
      if (provider === 'github') {
        await GitHubRepositoryFact.collection.insertOne({ snapshot, repositoryId: 'one' });
      }
    }

    expect(await purgeExpiredGitHubSnapshots(cutoff)).toBe(1);
    expect(await purgeExpiredXSnapshots(cutoff)).toBe(1);
    expect(await GitHubDataSnapshot.countDocuments()).toBe(0);
    expect(await XDataSnapshot.countDocuments()).toBe(0);
    expect(await GitHubRepositoryFact.countDocuments()).toBe(0);
    expect(await ReputationSnapshot.countDocuments()).toBe(0);
    expect(await IntegrationSyncJob.countDocuments({ resultSnapshot: { $ne: null } })).toBe(0);
  });

  it('keeps the latest 20 Stellar scans and deletes facts with an obsolete scan', async () => {
    const identity = new Types.ObjectId();
    const scans = Array.from({ length: 21 }, (_, index) => ({
      _id: new Types.ObjectId(),
      identity,
      active: false,
      createdAt: new Date(Date.now() - index * 60_000),
    }));
    await StellarActivityScan.collection.insertMany(scans);
    const obsolete = scans[20]!;
    await StellarPaymentFact.collection.insertOne({ scan: obsolete._id, operationId: 'old' });
    await SorobanTransactionEvidence.collection.insertOne({ scan: obsolete._id, transactionHash: 'old' });

    expect(await trimStellarScanHistory()).toBe(1);
    expect(await StellarActivityScan.countDocuments({ identity })).toBe(20);
    expect(await StellarPaymentFact.countDocuments({ scan: obsolete._id })).toBe(0);
    expect(await SorobanTransactionEvidence.countDocuments({ scan: obsolete._id })).toBe(0);
  });
});
