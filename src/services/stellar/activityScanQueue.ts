import StellarActivityScan from '../../models/StellarActivityScan';
import type { StellarActivityScanDocument } from '../../types/stellar/scan';
import { SCAN_LEASE_MS } from '../../constants/services/stellar/activityScanQueue';
import { retryDelay } from '../../utils/services/stellar/activityScanQueue/retryDelay';
import { claimStellarActivityScan } from '../../utils/services/stellar/activityScanQueue/claimStellarActivityScan';

const MAX_CONSECUTIVE_FAILURES = 5;

const failStellarActivityScan = async (
  scan: StellarActivityScanDocument,
  message: string,
  retryable: boolean,
  now = new Date(),
): Promise<void> => {
  const failures = scan.consecutiveFailures + 1;
  const shouldRetry = retryable && failures < MAX_CONSECUTIVE_FAILURES;

  await StellarActivityScan.updateOne(
    { _id: scan._id, status: 'running', leaseUntil: scan.leaseUntil, cursor: scan.cursor },
    {
      $set: {
        status: shouldRetry ? 'queued' : 'failed',
        active: shouldRetry,
        consecutiveFailures: failures,
        scheduledAt: shouldRetry
          ? new Date(now.getTime() + retryDelay(failures))
          : scan.scheduledAt,
        leaseUntil: null,
        completedAt: shouldRetry ? null : now,
        lastError: message.slice(0, 2_000),
      },
    },
    { runValidators: true },
  );
};

export {
  claimStellarActivityScan,
  failStellarActivityScan,
};

export { SCAN_LEASE_MS };
