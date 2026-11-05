import mongoose, { Types } from 'mongoose';

import ReputationCleanupJob from '../models/ReputationCleanupJob';
import cleanupDisconnectedAccounts from '../services/reputation/cleanupDisconnectedAccounts';

const processConnectionCleanup = async (jobId?: string): Promise<void> => {
  const now = new Date();

  const job = await ReputationCleanupJob.findOneAndUpdate(
    {
      ...(jobId ? { _id: new Types.ObjectId(jobId) } : {}),
      $or: [
        { status: 'queued', scheduledAt: { $lte: now } },
        { status: 'running', leaseUntil: { $lte: now } },
      ],
    },
    {
      $set: { status: 'running', leaseUntil: new Date(Date.now() + 300000) },
      $inc: { attempts: 1 },
    },
    { returnDocument: 'after', sort: { scheduledAt: 1 } },
  );

  if (!job) {
    return;
  }

  const owner = { _id: job._id, status: 'running' as const, leaseUntil: job.leaseUntil };

  try {
    await mongoose.connection.transaction(async (session): Promise<void> => {
      await cleanupDisconnectedAccounts(job.toObject(), session);

      const saved = await ReputationCleanupJob.updateOne(
        owner,
        { $set: { status: 'completed', leaseUntil: null, lastError: null } },
        { session },
      );

      if (saved.matchedCount !== 1) {
        throw new Error('Reputation cleanup lease expired');
      }
    });
  } catch (error) {
    await ReputationCleanupJob.updateOne(owner, {
      $set: {
        status: 'queued',
        leaseUntil: null,
        scheduledAt: new Date(Date.now() + 60000),
        lastError: error instanceof Error ? error.message : 'Reputation cleanup failed',
      },
    });

    throw error;
  }
};

export default processConnectionCleanup;
