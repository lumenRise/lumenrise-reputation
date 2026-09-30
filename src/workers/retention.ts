import logEvent from '../logEvent';
import runRetentionSweep from '../services/retention/runRetentionSweep';

const DAY_MS = 24 * 60 * 60 * 1_000;

const startRetentionWorker = () => {
  let active: Promise<void> | null = null;
  const run = (): Promise<void> => {
    if (active) {
      return active;
    }
    active = runRetentionSweep().finally(() => { active = null; });
    return active;
  };
  const timer = setInterval(() => {
    void run().catch((error: unknown) => logEvent('error', 'retention_sweep_failed', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
    }));
  }, DAY_MS);
  void run().catch((error: unknown) => logEvent('error', 'retention_sweep_failed', {
    errorName: error instanceof Error ? error.name : 'UnknownError',
  }));

  return {
    stop: async (): Promise<void> => {
      clearInterval(timer);
      await active?.catch(() => {});
    },
  };
};

export { startRetentionWorker };
