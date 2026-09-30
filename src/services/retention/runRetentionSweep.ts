import purgeExpiredXSnapshots from './purgeExpiredXSnapshots';
import trimStellarScanHistory from './trimStellarScanHistory';
import purgeExpiredGitHubSnapshots from './purgeExpiredGitHubSnapshots';

const RETENTION_MS = 90 * 24 * 60 * 60 * 1_000;

const runRetentionSweep = async (now = new Date()): Promise<void> => {
  const cutoff = new Date(now.getTime() - RETENTION_MS);
  await purgeExpiredGitHubSnapshots(cutoff);
  await purgeExpiredXSnapshots(cutoff);
  await trimStellarScanHistory();
};

export default runRetentionSweep;
