import logEvent from '../../../../logEvent';
import type { StellarActivityScanDocument } from '../../../../types/stellar/scan';
import { failStellarActivityScan } from '../../../../services/stellar/activityScanQueue';
import { mergeStellarActivityPage } from '../../../../services/stellar/mergeActivityPage';
import getStellarAccountOperations from '../../../../services/stellar/getAccountOperations';
import persistStellarPaymentPage from '../../../../services/sybil/persistStellarPaymentPage';
import getSorobanEvidenceForPage from '../../../../services/stellar/getSorobanEvidenceForPage';

const processStellarActivityScan = async (scan: StellarActivityScanDocument): Promise<void> => {
  try {
    const page = await getStellarAccountOperations(
      scan.address,
      scan.cursor,
      200,
      'desc',
      scan.sourceUrl,
    );

    if (!page) {
      await failStellarActivityScan(scan, 'Stellar account was not found', false);
      return;
    }

    const merged = mergeStellarActivityPage(
      scan.summary,
      page,
      scan.lastDay,
      scan.lastTransactionHash,
    );

    const now = new Date();
    const sorobanEvidence = getSorobanEvidenceForPage(scan, page);

    await persistStellarPaymentPage(scan, page, merged, now, sorobanEvidence);
  } catch (error) {
    const message = error instanceof Error ? error.name : 'UnknownError';

    await failStellarActivityScan(scan, message, true);
    logEvent('warn', 'stellar_scan_page_failed', {
      scanId: scan._id.toString(),
      identityId: scan.identity.toString(),
      attempts: scan.consecutiveFailures + 1,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
  }
};

export { processStellarActivityScan };
