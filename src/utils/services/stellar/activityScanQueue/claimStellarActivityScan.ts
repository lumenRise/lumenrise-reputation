import StellarActivityScan from '../../../../models/StellarActivityScan.js';
import { Types } from 'mongoose';
import type { StellarActivityScanDocument } from '../../../../types/stellar/scan.js';
import { SCAN_LEASE_MS } from '../../../../constants/services/stellar/activityScanQueue.js';

const claimStellarActivityScan = async (
  scanId?: string,
  now = new Date(),
): Promise<StellarActivityScanDocument | null> =>
  StellarActivityScan.findOneAndUpdate(
    {
      ...(scanId ? { _id: new Types.ObjectId(scanId) } : {}),
      active: true,
      $or: [
        { status: 'queued', scheduledAt: { $lte: now } },
        { status: 'running', leaseUntil: { $lte: now } },
      ],
    },
    { $set: { status: 'running', leaseUntil: new Date(now.getTime() + SCAN_LEASE_MS) } },
    { sort: { scheduledAt: 1 }, runValidators: true, returnDocument: 'after' },
  );

export { claimStellarActivityScan };
