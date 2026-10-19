import SorobanTransactionEvidence from '../../../../models/SorobanTransactionEvidence';
import getNetworkConfig from '../../../../services/network/getNetworkConfig';

const LEASE_MS = 60_000;

const claimSorobanEvidence = async () => {
  const now = new Date();

  const networks = (['testnet', 'public'] as const).filter(
    (network) => getNetworkConfig(network).rpcUrl,
  );

  await SorobanTransactionEvidence.updateMany(
    {
      network: { $in: networks },
      attempts: { $gte: 3 },
      $or: [
        { rpcStatus: 'queued', scheduledAt: { $lte: now } },
        { rpcStatus: 'running', leaseUntil: { $lte: now } },
      ],
    },
    { $set: { rpcStatus: 'unavailable', leaseUntil: null } },
    { runValidators: true },
  );
  return SorobanTransactionEvidence.findOneAndUpdate(
    {
      network: { $in: networks },
      attempts: { $lt: 3 },
      $or: [
        { rpcStatus: 'queued', scheduledAt: { $lte: now } },
        { rpcStatus: 'running', leaseUntil: { $lte: now } },
      ],
    },
    {
      $set: { rpcStatus: 'running', leaseUntil: new Date(now.getTime() + LEASE_MS) },
      $inc: { attempts: 1 },
    },
    { sort: { scheduledAt: 1 }, returnDocument: 'after' },
  );
};

export default claimSorobanEvidence;
