import { Networks } from '@stellar/stellar-sdk';

import env from '../../env';
import type { StellarNetwork, NetworkConfiguration } from '../../types/network/configuration';

const getNetworkConfig = (
  network: StellarNetwork,
  configuration: typeof env = env,
): Readonly<NetworkConfiguration> => {
  if (network === 'testnet') {
    return {
      network,
      rpcUrl: configuration.STELLAR_TESTNET_RPC_URL,
      horizonUrl: configuration.STELLAR_TESTNET_HORIZON_URL,
      networkPassphrase: Networks.TESTNET,
    };
  }

  return {
    network,
    rpcUrl: configuration.STELLAR_PUBLIC_RPC_URL,
    horizonUrl: configuration.STELLAR_PUBLIC_HORIZON_URL,
    networkPassphrase: Networks.PUBLIC,
  };
};

export default getNetworkConfig;
