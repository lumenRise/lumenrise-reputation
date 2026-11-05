import { Types } from 'mongoose';
import type { Types as MongooseTypes } from 'mongoose';

import StellarActivityScan from '../../models/StellarActivityScan';
import type { StellarNetwork } from '../../types/network/configuration';
import type { SorobanEvidenceResult } from '../../types/stellar/soroban';
import SorobanTransactionEvidence from '../../models/SorobanTransactionEvidence';
import extractSorobanEnvelopeEvidence from '../../services/stellar/extractSorobanEnvelopeEvidence';

const readSorobanEvidence = async (
  identity: MongooseTypes.ObjectId,
  address: string,
  network: StellarNetwork,
  limit: number,
  cursor?: string,
): Promise<SorobanEvidenceResult | null> => {
  const scan = await StellarActivityScan.findOne({ identity, address, network }).sort({
    createdAt: -1,
  });

  if (!scan) {
    return null;
  }

  const filter = {
    scan: scan._id,
    ...(typeof cursor === 'string' ? { _id: { $lt: new Types.ObjectId(cursor) } } : {}),
  };

  const [records, totals] = await Promise.all([
    SorobanTransactionEvidence.find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1),
    SorobanTransactionEvidence.aggregate<{
      _id: string;
      count: number;
    }>([{ $match: { scan: scan._id } }, { $group: { _id: '$rpcStatus', count: { $sum: 1 } } }]),
  ]);

  const counts = Object.fromEntries(totals.map(({ _id, count }) => [_id, count]));
  const items = records.slice(0, limit);

  return {
    scanId: scan._id.toString(),
    address,
    ownershipVerified: false,
    source: 'horizon_and_stellar_rpc',
    scanStatus: scan.status,
    availableHistoryScanned: scan.status === 'completed',
    coverage: {
      discoveredTransactions: Object.values(counts).reduce((sum, count) => sum + count, 0),
      rpcQueued: counts.queued ?? 0,
      rpcRunning: counts.running ?? 0,
      rpcSuccess: counts.success ?? 0,
      rpcFailed: counts.failed ?? 0,
      rpcNotFound: counts.not_found ?? 0,
      rpcUnavailable: counts.unavailable ?? 0,
    },
    items: items.map((item) => ({
      transactionHash: item.transactionHash,
      operationIds: item.operationIds,
      initiatedOperation: item.initiatedOperation,
      observedAt: item.observedAt.toISOString(),
      rpcStatus: item.rpcStatus,
      attempts: item.attempts,
      ledger: item.ledger,
      returnValueXdr: item.returnValueXdr,
      envelope: extractSorobanEnvelopeEvidence(item.envelopeXdr),
      events: item.events.map((event) => ({
        operationIndex: event.operationIndex,
        eventIndex: event.eventIndex,
        contractId: event.contractId,
        eventXdr: event.eventXdr,
      })),
    })),
    nextCursor: records.length > limit ? items.at(-1)!._id.toString() : null,
  };
};

export default readSorobanEvidence;
