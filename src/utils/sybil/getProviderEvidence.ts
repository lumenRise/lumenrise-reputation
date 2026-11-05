import XDataSnapshot from '../../models/XDataSnapshot';
import GitHubDataSnapshot from '../../models/GitHubDataSnapshot';
import ReputationCleanupJob from '../../models/ReputationCleanupJob';
import type { SybilProviderEvidence } from '../../types/sybil/evidence';
import type { ExternalAccountDocument } from '../../types/integration/model';

const getProviderEvidence = async (
  account: ExternalAccountDocument,
): Promise<SybilProviderEvidence> => {
  const cleanup = await ReputationCleanupJob.findOne({ externalAccount: account._id })
    .sort({ cutoff: -1 })
    .lean();

  const filter = {
    identity: account.identity,
    externalAccount: account._id,
    ...(cleanup ? { collectedAt: { $gt: cleanup.cutoff } } : {}),
  };

  const snapshot =
    account.provider === 'github'
      ? await GitHubDataSnapshot.findOne(filter).sort({ collectedAt: -1 })
      : await XDataSnapshot.findOne(filter).sort({ collectedAt: -1 });

  return {
    provider: account.provider,
    snapshot: snapshot
      ? {
          id: snapshot._id.toString(),
          status: snapshot.status,
          dataVersion: snapshot.dataVersion,
          collectedAt: snapshot.collectedAt.toISOString(),
          profileCovered: snapshot.coverage.profile,
          activityCovered: 'contributions' in snapshot.coverage && snapshot.coverage.contributions,
          accountAgeDays: snapshot.metrics.accountAgeDays,
          commitCount:
            'allTimeCommits' in snapshot.metrics ? snapshot.metrics.allTimeCommits : null,
        }
      : null,
  };
};

export default getProviderEvidence;
