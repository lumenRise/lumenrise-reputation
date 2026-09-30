import { withDatabaseTransaction } from '../../db';
import IntegrationSyncJob from '../../models/IntegrationSyncJob';
import ReputationSnapshot from '../../models/ReputationSnapshot';
import GitHubDataSnapshot from '../../models/GitHubDataSnapshot';
import GitHubRepositoryFact from '../../models/GitHubRepositoryFact';

const purgeExpiredGitHubSnapshots = async (cutoff: Date): Promise<number> => {
  const snapshots = await GitHubDataSnapshot.find({ collectedAt: { $lt: cutoff } })
    .select('_id')
    .limit(100);

  for (const snapshot of snapshots) {
    await withDatabaseTransaction(async (session) => {
      await ReputationSnapshot.deleteMany({ 'sources.snapshot': snapshot._id }).session(session);
      await IntegrationSyncJob.updateMany(
        { resultSnapshot: snapshot._id },
        { $set: { resultSnapshot: null } },
        { session },
      );
      await GitHubRepositoryFact.deleteMany({ snapshot: snapshot._id }).session(session);
      await GitHubDataSnapshot.deleteOne({ _id: snapshot._id }).session(session);
    });
  }
  return snapshots.length;
};

export default purgeExpiredGitHubSnapshots;
