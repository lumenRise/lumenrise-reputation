import type env from './env';
import parseProviderUrl from './utils/configuration/parseProviderUrl';
const validateRuntimeConfiguration = (configuration: typeof env): void => {
  if (!Number.isSafeInteger(configuration.SYNC_WORKER_POLL_INTERVAL_MS) ||
      configuration.SYNC_WORKER_POLL_INTERVAL_MS <= 0) {
    throw new Error('SYNC_WORKER_POLL_INTERVAL_MS must be a positive integer');
  }
  if (!Number.isSafeInteger(configuration.HEALTH_PORT) ||
      configuration.HEALTH_PORT < 1 || configuration.HEALTH_PORT > 65_535) {
    throw new Error('HEALTH_PORT must be a valid TCP port');
  }
  if (!Number.isFinite(configuration.X_AUTO_SYNC_INTERVAL_HOURS) ||
      configuration.X_AUTO_SYNC_INTERVAL_HOURS < 0) {
    throw new Error('X_AUTO_SYNC_INTERVAL_HOURS must be non-negative');
  }
  if (configuration.X_AUTO_SYNC_INTERVAL_HOURS !== 0) {
    throw new Error('X_AUTO_SYNC_INTERVAL_HOURS must be 0 while refresh is manual only');
  }
  if (Boolean(configuration.GITHUB_CLIENT_ID) !== Boolean(configuration.GITHUB_CLIENT_SECRET)) {
    throw new Error('GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET must be configured together');
  }
  if (Boolean(configuration.X_CLIENT_ID) !== Boolean(configuration.X_CLIENT_SECRET)) {
    throw new Error('X_CLIENT_ID and X_CLIENT_SECRET must be configured together');
  }
  if (!/^[a-f\d]{64}$/i.test(configuration.CREDENTIAL_ENCRYPTION_KEY)) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY must be a 64-character hexadecimal key');
  }

  const production = configuration.NODE_ENV === 'production';
  const horizon = parseProviderUrl(configuration.STELLAR_HORIZON_URL, 'STELLAR_HORIZON_URL', production);
  const rpc = parseProviderUrl(configuration.STELLAR_RPC_URL, 'STELLAR_RPC_URL', production);
  for (const [name, url] of [['STELLAR_HORIZON_URL', horizon], ['STELLAR_RPC_URL', rpc]] as const) {
    if (url.hostname.endsWith('.stellar.org')) {
      const isTestnet = url.hostname.includes('testnet');
      if ((configuration.STELLAR_AUTH_NETWORK === 'testnet') !== isTestnet) {
        throw new Error(`${name} does not match STELLAR_AUTH_NETWORK`);
      }
    }
  }
};

export default validateRuntimeConfiguration;
