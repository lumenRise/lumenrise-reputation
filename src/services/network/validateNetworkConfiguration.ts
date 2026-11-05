import type { NetworkConfiguration } from '../../types/network/configuration';

const validateNetworkConfiguration = (configuration: Readonly<NetworkConfiguration>): void => {
  const { network, horizonUrl, rpcUrl } = configuration;

  for (const value of [horizonUrl, rpcUrl]) {
    if (!value) {
      continue;
    }

    const url = new URL(value);

    if (
      (url.protocol !== 'https:' && !(network === 'testnet' && url.protocol === 'http:')) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new Error(`Invalid ${network} provider URL`);
    }
  }

  if (!horizonUrl) {
    throw new Error(`Horizon URL is required for ${network}`);
  }
};

export default validateNetworkConfiguration;
