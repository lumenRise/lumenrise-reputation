import { calculateXSyncSchedule } from './calculateXSyncSchedule';
import { enqueueIntegrationSync } from './enqueueIntegrationSync';
import type { ExternalAccountDocument } from '../../../../types/integration/model';
import type { IntegrationSyncJobDocument } from '../../../../types/integration/sync';

const enqueueXSync = async (
  account: ExternalAccountDocument,
  now = new Date(),
): Promise<IntegrationSyncJobDocument> => {
  const scheduledAt = calculateXSyncSchedule(account.lastSyncedAt, now);

  return enqueueIntegrationSync(account, 'x', scheduledAt, 'X');
};

export { enqueueXSync };
