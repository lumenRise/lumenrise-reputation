import { processSorobanEvidence } from '../utils/services/stellar/sorobanEvidenceWorker/processSorobanEvidence.js';

const startSorobanEvidenceWorker = (pollIntervalMs: number) => {
  let activeTick: Promise<void> | null = null;
  const run = (): Promise<void> => {
    if (activeTick) return activeTick;
    activeTick = processSorobanEvidence().finally(() => { activeTick = null; });
    return activeTick;
  };

  const timer = setInterval(() => {
    void run().catch((error: unknown) => console.error('Soroban evidence lookup failed', error));
  }, pollIntervalMs);
  void run().catch((error: unknown) => console.error('Soroban evidence lookup failed', error));

  return {
    stop: async (): Promise<void> => {
      clearInterval(timer);
      await activeTick;
    },
  };
};

export { startSorobanEvidenceWorker };
