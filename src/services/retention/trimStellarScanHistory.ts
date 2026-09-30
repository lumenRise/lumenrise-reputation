import { withDatabaseTransaction } from '../../db';
import StellarPaymentFact from '../../models/StellarPaymentFact';
import StellarActivityScan from '../../models/StellarActivityScan';
import SorobanTransactionEvidence from '../../models/SorobanTransactionEvidence';

const trimStellarScanHistory = async (): Promise<number> => {
  const identities = await StellarActivityScan.distinct('identity');
  let deleted = 0;
  for (const identity of identities) {
    const obsolete = await StellarActivityScan.find({ identity })
      .sort({ createdAt: -1, _id: -1 })
      .skip(20)
      .limit(100)
      .select('_id active');

    for (const scan of obsolete) {
      if (scan.active) {
        continue;
      }
      const removed = await withDatabaseTransaction(async (session) => {
        const result = await StellarActivityScan.deleteOne({ _id: scan._id, active: false }).session(session);
        if (result.deletedCount === 0) {
          return 0;
        }
        await StellarPaymentFact.deleteMany({ scan: scan._id }).session(session);
        await SorobanTransactionEvidence.deleteMany({ scan: scan._id }).session(session);
        return result.deletedCount;
      });
      deleted += removed;
    }
  }
  return deleted;
};

export default trimStellarScanHistory;
