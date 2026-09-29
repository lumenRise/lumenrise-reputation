import env from '../env.js';
import { X_SYNC_SCAN_INTERVAL_MS } from '../constants/services/integration/xScheduler.js';
import { enqueueDueXSyncs } from '../utils/services/integration/xScheduler/enqueueDueXSyncs.js';

const startXScheduler = () => {
  let activeScan: Promise<void> | null = null;
  const run = (): Promise<void> => {
    if (activeScan) return activeScan;
    activeScan = enqueueDueXSyncs().then(() => {}).finally(() => { activeScan = null; });
    return activeScan;
  };

  const timer = env.X_AUTO_SYNC_INTERVAL_HOURS > 0
    ? setInterval(() => {
        void run().catch((error: unknown) => console.error('X sync scheduling failed', error));
      }, X_SYNC_SCAN_INTERVAL_MS)
    : null;
  if (timer) void run().catch((error: unknown) => console.error('X sync scheduling failed', error));

  return {
    stop: async (): Promise<void> => {
      if (timer) clearInterval(timer);
      await activeScan;
    },
  };
};

export { startXScheduler };
