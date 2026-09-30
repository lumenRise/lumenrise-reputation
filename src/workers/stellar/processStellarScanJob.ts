import { claimStellarActivityScan } from '../../utils/services/stellar/activityScanQueue/claimStellarActivityScan';
import { processStellarActivityScan } from '../../utils/services/stellar/activityScanWorker/processStellarActivityScan';
const processStellarScanJob = async (scanId?: string): Promise<void> => {
  const scan = await claimStellarActivityScan(scanId);
  if (scan) {
    await processStellarActivityScan(scan);
  }
};

export default processStellarScanJob;
