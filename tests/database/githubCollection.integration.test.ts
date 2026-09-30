import { randomUUID } from 'node:crypto';
import mongoose, { Types } from 'mongoose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import GitHubDataSnapshot from '../../src/models/GitHubDataSnapshot';
import GitHubRepositoryFact from '../../src/models/GitHubRepositoryFact';
import { collectGitHubData } from '../../src/services/reputation/githubData';

const mocks = vi.hoisted(() => ({
  contributions: vi.fn(),
  repositories: vi.fn(),
}));

vi.mock('../../src/utils/services/reputation/githubData/collectContributionPeriods', () => ({
  collectContributionPeriods: mocks.contributions,
}));
vi.mock('../../src/utils/services/reputation/githubData/collectAllRepositories', () => ({
  collectAllRepositories: mocks.repositories,
}));

const databaseName = `lumenrise_github_collection_${randomUUID().replaceAll('-', '')}`;

describe.runIf(Boolean(process.env.LUMENRISE_TEST_DB_URI))('GitHub collection transaction', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.LUMENRISE_TEST_DB_URI!, {
      dbName: databaseName,
      serverSelectionTimeoutMS: 5_000,
    });
    await Promise.all([GitHubDataSnapshot.createIndexes(), GitHubRepositoryFact.createIndexes()]);
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
    }
    await mongoose.disconnect();
  });

  it('rolls back the snapshot and first fact batch when a later batch fails', async () => {
    mocks.contributions.mockResolvedValue([]);
    mocks.repositories.mockResolvedValue(Array.from({ length: 501 }, (_, index) => ({
      databaseId: index + 1,
      nameWithOwner: `owner/repo-${index}`,
      isFork: false,
      isArchived: false,
      stargazerCount: 0,
      forkCount: 0,
      watchers: { totalCount: 0 },
      issues: { totalCount: 0 },
      pullRequests: { totalCount: 0 },
      releases: { totalCount: 0 },
      createdAt: '2020-01-01T00:00:00Z',
      pushedAt: null,
      primaryLanguage: null,
    })));

    const original = GitHubRepositoryFact.insertMany.bind(GitHubRepositoryFact);
    let batches = 0;
    const write = vi.spyOn(GitHubRepositoryFact, 'insertMany').mockImplementation(async (...args) => {
      batches += 1;
      if (batches === 2) {
        throw new Error('Simulated second batch failure');
      }
      return original(...args);
    });

    try {
      await expect(collectGitHubData(
        new Types.ObjectId(),
        new Types.ObjectId(),
        {
          id: 42,
          login: 'owner',
          name: 'Owner',
          html_url: 'https://github.com/owner',
          avatar_url: 'https://example.com/avatar',
          created_at: '2020-01-01T00:00:00Z',
          public_repos: 501,
          public_gists: 0,
          followers: 0,
          following: 0,
        },
        'token',
      )).rejects.toThrow('Simulated second batch failure');
      expect(batches).toBe(2);
      expect(await GitHubDataSnapshot.countDocuments()).toBe(0);
      expect(await GitHubRepositoryFact.countDocuments()).toBe(0);
    } finally {
      write.mockRestore();
    }
  });
});
