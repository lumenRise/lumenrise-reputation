import { withDatabaseTransaction } from '../../db';
import XDataSnapshot from '../../models/XDataSnapshot';
import IntegrationSyncJob from '../../models/IntegrationSyncJob';
import ReputationSnapshot from '../../models/ReputationSnapshot';

const purgeExpiredXSnapshots = async (cutoff: Date): Promise<number> => {
  const snapshots = await XDataSnapshot.find({ collectedAt: { $lt: cutoff } })
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
      await XDataSnapshot.deleteOne({ _id: snapshot._id }).session(session);
    });
  }
  return snapshots.length;
};

export default purgeExpiredXSnapshots;
