import ExternalAccount from '../../models/ExternalAccount';
import ReputationSnapshot from '../../models/ReputationSnapshot';
import type { ReputationSnapshotDocument } from '../../types/reputation/model';
import type { GitHubDataSnapshotDocument } from '../../types/reputation/github';
import { createGitHubSignals } from '../../utils/services/reputation/developerScore/createGitHubSignals';
import type {
  DeveloperReputationSourceInput,
  DeveloperSignalInput,
} from '../../types/reputation/scoring';
import { calculateDeveloperScore } from '../../utils/services/reputation/developerScore/calculateDeveloperScore';
import { normalizeDiminishingReturns } from '../../utils/services/reputation/developerScore/normalizeDiminishingReturns';
const DEVELOPER_ALGORITHM_VERSION = 'developer-v2';

const calculateAndStoreDeveloperReputation = async (
  githubSnapshot: GitHubDataSnapshotDocument,
  calculatedAt = new Date(),
): Promise<ReputationSnapshotDocument | null> => {
  const accountFilter = {
    _id: githubSnapshot.externalAccount,
    identity: githubSnapshot.identity,
    provider: 'github',
    providerAccountId: githubSnapshot.providerAccountId,
    status: 'connected',
  } as const;
  if (!(await ExternalAccount.exists(accountFilter))) {
    return null;
  }

  const inputs: DeveloperSignalInput[] = [];
  const sources: DeveloperReputationSourceInput[] = [];

  if (githubSnapshot) {
    inputs.push(...createGitHubSignals(githubSnapshot));
    sources.push({
      provider: 'github',
      snapshot: githubSnapshot._id,
      dataVersion: githubSnapshot.dataVersion,
      collectedAt: githubSnapshot.collectedAt,
      status: githubSnapshot.status,
    });
  }

  const status = sources.every((source) => source.status === 'complete') ? 'complete' : 'partial';

  const calculation = calculateDeveloperScore(inputs, status);

  const reputation = await ReputationSnapshot.create({
    identity: githubSnapshot.identity,
    category: 'developer',
    status: calculation.status,
    algorithmVersion: DEVELOPER_ALGORITHM_VERSION,
    score: calculation.score,
    signals: calculation.signals,
    sources: sources.map((source) => ({
      provider: source.provider,
      snapshot: source.snapshot,
      dataVersion: source.dataVersion,
      collectedAt: source.collectedAt,
    })),
    calculatedAt,
  });
  if (!(await ExternalAccount.exists(accountFilter))) {
    await ReputationSnapshot.deleteOne({ _id: reputation._id });
    return null;
  }
  return reputation;
};

export {
  DEVELOPER_ALGORITHM_VERSION,
  calculateAndStoreDeveloperReputation,
  calculateDeveloperScore,
  createGitHubSignals,
  normalizeDiminishingReturns,
};
