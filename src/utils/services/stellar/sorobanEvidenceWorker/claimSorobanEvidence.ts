import SorobanTransactionEvidence from '../../../../models/SorobanTransactionEvidence';

const LEASE_MS = 60_000;

const claimSorobanEvidence = async () => {
  const now = new Date();
  await SorobanTransactionEvidence.updateMany(
    {
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
