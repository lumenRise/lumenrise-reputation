import type { ClientSession, Types } from 'mongoose';

import XDataSnapshot from '../../models/XDataSnapshot';
import GitHubDataSnapshot from '../../models/GitHubDataSnapshot';
import IntegrationSyncJob from '../../models/IntegrationSyncJob';
import ReputationSnapshot from '../../models/ReputationSnapshot';
import type { ReputationCleanupRecord } from '../../types/reputation/cleanup';

const cleanupDisconnectedAccounts = async (
  job: ReputationCleanupRecord,
  session: ClientSession,
): Promise<void> => {
  const filter = {
    identity: job.identity,
    externalAccount: job.externalAccount,
    collectedAt: { $lte: job.cutoff },
  };

  const snapshots = (
    job.provider === 'x'
      ? await XDataSnapshot.distinct('_id', filter).session(session)
      : await GitHubDataSnapshot.distinct('_id', filter).session(session)
  ) as Types.ObjectId[];

  await ReputationSnapshot.deleteMany(
    {
      identity: job.identity,
      category: job.provider === 'x' ? 'social' : 'developer',
      $or: [{ calculatedAt: { $lte: job.cutoff } }, { 'sources.snapshot': { $in: snapshots } }],
    },
    { session },
  );

  if (job.provider === 'x') {
    await XDataSnapshot.deleteMany({ ...filter, _id: { $in: snapshots } }, { session });

    await IntegrationSyncJob.updateMany(
      { externalAccount: job.externalAccount, provider: 'x', resultSnapshot: { $in: snapshots } },
      { $set: { resultSnapshot: null } },
      { session },
    );
  }
};

export default cleanupDisconnectedAccounts;
