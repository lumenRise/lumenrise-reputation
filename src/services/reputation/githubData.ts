import type { Types } from 'mongoose';

import { withDatabaseTransaction } from '../../db';
import GitHubDataSnapshot from '../../models/GitHubDataSnapshot';
import type { GitHubUser } from '../../types/integration/github';
import type { GitHubDataSnapshotDocument } from '../../types/reputation/github';
import { buildMetrics } from '../../utils/services/reputation/githubData/buildMetrics';
import { storeRepositoryFacts } from '../../utils/services/reputation/githubData/storeRepositoryFacts';
import { collectAllRepositories } from '../../utils/services/reputation/githubData/collectAllRepositories';
import { createContributionRanges } from '../../utils/services/reputation/githubData/createContributionRanges';
import {
  MILLISECONDS_PER_DAY,
  GITHUB_GRAPHQL_URL,
} from '../../constants/services/reputation/githubData';
import { collectContributionPeriods } from '../../utils/services/reputation/githubData/collectContributionPeriods';

const GITHUB_DATA_VERSION = 'github-data-v1';

const collectGitHubData = async (
  identityId: Types.ObjectId,
  externalAccountId: Types.ObjectId,
  user: GitHubUser,
  accessToken: string,
  collectedAt = new Date(),
): Promise<GitHubDataSnapshotDocument> => {
  const ranges = createContributionRanges(new Date(user.created_at), collectedAt);

  const [periodsResult, repositoriesResult] = await Promise.allSettled([
    collectContributionPeriods(user.login, accessToken, ranges),
    collectAllRepositories(user.login, accessToken),
  ]);

  const periods = periodsResult.status === 'fulfilled' ? periodsResult.value : [];
  const repositories = repositoriesResult.status === 'fulfilled' ? repositoriesResult.value : [];

  const status =
    periodsResult.status === 'fulfilled' && repositoriesResult.status === 'fulfilled'
      ? 'complete'
      : 'partial';

  const metrics = buildMetrics(user, repositories, periods, collectedAt);

  return withDatabaseTransaction(async (session) => {
    const snapshots = await GitHubDataSnapshot.create([{
      identity: identityId,
      externalAccount: externalAccountId,
      providerAccountId: user.id.toString(),
      username: user.login,
      status,
      dataVersion: GITHUB_DATA_VERSION,
      coverage: {
        profile: true,
        contributions: periodsResult.status === 'fulfilled',
        repositories: repositoriesResult.status === 'fulfilled',
      },
      metrics,
      contributionPeriods: periods,
      collectedAt,
    }], { session });
    const snapshot = snapshots[0];
    if (!snapshot) {
      throw new Error('GitHub snapshot was not created');
    }

    await storeRepositoryFacts(
      snapshot._id,
      identityId,
      user.id.toString(),
      repositories,
      collectedAt,
      session,
    );
    return snapshot;
  });
};

export { buildMetrics, collectAllRepositories, collectGitHubData, createContributionRanges };

export { GITHUB_GRAPHQL_URL, MILLISECONDS_PER_DAY };
