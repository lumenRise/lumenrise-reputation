import { randomUUID } from 'node:crypto';
import mongoose, { Types } from 'mongoose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import XDataSnapshot from '../../src/models/XDataSnapshot';
import ExternalAccount from '../../src/models/ExternalAccount';
import ReputationSnapshot from '../../src/models/ReputationSnapshot';
import GitHubDataSnapshot from '../../src/models/GitHubDataSnapshot';
import { calculateAndStoreSocialReputation } from '../../src/services/reputation/socialScore';
import { calculateAndStoreDeveloperReputation } from '../../src/services/reputation/developerScore';

const databaseName = `lumenrise_connection_race_${randomUUID().replaceAll('-', '')}`;

describe.runIf(Boolean(process.env.LUMENRISE_TEST_DB_URI))('score storage during disconnect', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.LUMENRISE_TEST_DB_URI!, {
      dbName: databaseName,
      serverSelectionTimeoutMS: 5_000,
    });
    await Promise.all([ExternalAccount.createIndexes(), ReputationSnapshot.createIndexes()]);
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
    }
    await mongoose.disconnect();
  });

  for (const [provider, category] of [['github', 'developer'], ['x', 'social']] as const) {
    it(`does not retain a ${category} score if ${provider} disconnects during storage`, async () => {
      const identity = new Types.ObjectId();
      const account = await ExternalAccount.create({
        identity,
        provider,
        providerAccountId: `${provider}-${randomUUID()}`,
        username: 'user',
        connectedAt: new Date(),
      });
      const base = {
        identity,
        externalAccount: account._id,
        providerAccountId: account.providerAccountId,
        status: 'partial',
        dataVersion: 'v1',
        collectedAt: new Date(),
      };
      const github = new GitHubDataSnapshot({
        ...base,
        coverage: { profile: true, repositories: false, contributions: false },
        metrics: { accountAgeDays: 365, followerCount: 10 },
      });
      const x = new XDataSnapshot({
        ...base,
        coverage: { profile: true, posts: false },
        metrics: { accountAgeDays: 365, followerCount: 10, listedCount: 0, reportedPostCount: 0 },
      });
      const original = ReputationSnapshot.create.bind(ReputationSnapshot);
      const create = vi.spyOn(ReputationSnapshot, 'create').mockImplementation(async (...args) => {
        const result = await original(...args);
        await ExternalAccount.updateOne(
          { _id: account._id },
          { $set: { status: 'disconnected', disconnectedAt: new Date() } },
        );
        return result;
      });
      try {
        const result = provider === 'github'
          ? await calculateAndStoreDeveloperReputation(github)
          : await calculateAndStoreSocialReputation(x);
        expect(result).toBeNull();
        expect(await ReputationSnapshot.countDocuments({ identity, category })).toBe(0);
      } finally {
        create.mockRestore();
      }
    });
  }
});
