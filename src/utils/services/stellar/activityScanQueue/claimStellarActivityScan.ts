import { Types } from 'mongoose';

import StellarActivityScan from '../../../../models/StellarActivityScan';
import type { StellarActivityScanDocument } from '../../../../types/stellar/scan';
import { SCAN_LEASE_MS } from '../../../../constants/services/stellar/activityScanQueue';
const claimStellarActivityScan = async (
  scanId?: string,
  now = new Date(),
): Promise<StellarActivityScanDocument | null> => {
  const idFilter = scanId ? { _id: new Types.ObjectId(scanId) } : {};
  await StellarActivityScan.updateMany(
    {
      ...idFilter,
      active: true,
      consecutiveFailures: { $gte: 4 },
      $or: [
        { status: 'queued', scheduledAt: { $lte: now }, consecutiveFailures: { $gte: 5 } },
        { status: 'running', leaseUntil: { $lte: now } },
      ],
    },
    { $set: { status: 'failed', active: false, completedAt: now, leaseUntil: null,
      lastError: 'Retry limit reached after worker interruption' } },
    { runValidators: true },
  );
  const leaseUntil = new Date(now.getTime() + SCAN_LEASE_MS);
  const queued = await StellarActivityScan.findOneAndUpdate(
    { ...idFilter, active: true, status: 'queued', scheduledAt: { $lte: now },
      consecutiveFailures: { $lt: 5 } },
    { $set: { status: 'running', leaseUntil } },
    { sort: { scheduledAt: 1 }, runValidators: true, returnDocument: 'after' },
  );
  if (queued) {
    return queued;
  }
  return StellarActivityScan.findOneAndUpdate(
    { ...idFilter, active: true, status: 'running', leaseUntil: { $lte: now },
      consecutiveFailures: { $lt: 4 } },
    { $set: { leaseUntil }, $inc: { consecutiveFailures: 1 } },
    { sort: { scheduledAt: 1 }, runValidators: true, returnDocument: 'after' },
  );
};

export { claimStellarActivityScan };
