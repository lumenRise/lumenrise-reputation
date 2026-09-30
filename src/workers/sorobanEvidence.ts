import logEvent from '../logEvent';
import { processSorobanEvidence } from '../utils/services/stellar/sorobanEvidenceWorker/processSorobanEvidence';

const startSorobanEvidenceWorker = (pollIntervalMs: number) => {
  let activeTick: Promise<void> | null = null;
  const run = (): Promise<void> => {
    if (activeTick) {return activeTick;}
    activeTick = processSorobanEvidence().finally(() => { activeTick = null; });
    return activeTick;
  };

  const timer = setInterval(() => {
    void run().catch((error: unknown) => logEvent('error', 'soroban_evidence_worker_failed', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
    }));
  }, pollIntervalMs);
  void run().catch((error: unknown) => logEvent('error', 'soroban_evidence_worker_failed', {
    errorName: error instanceof Error ? error.name : 'UnknownError',
  }));

  return {
    stop: async (): Promise<void> => {
      clearInterval(timer);
      await activeTick;
    },
  };
};

export { startSorobanEvidenceWorker };
