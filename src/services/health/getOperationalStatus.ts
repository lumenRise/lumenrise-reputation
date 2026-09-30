import mongoose from 'mongoose';

import IntegrationSyncJob from '../../models/IntegrationSyncJob';
import StellarActivityScan from '../../models/StellarActivityScan';
import SorobanTransactionEvidence from '../../models/SorobanTransactionEvidence';

const getOperationalStatus = async (rabbitmqReady: boolean) => {
  const mongoReady = mongoose.connection.readyState === 1;
  if (!mongoReady) {
    return { ready: false, mongoReady, rabbitmqReady };
  }

  const [queuedSync, runningSync, failedSync, queuedScans, runningScans, failedScans,
    queuedEvidence, runningEvidence, failedEvidence, oldestSync, oldestScan, oldestEvidence,
    unavailableEvidence] = await Promise.all([
    IntegrationSyncJob.countDocuments({ status: 'queued' }),
    IntegrationSyncJob.countDocuments({ status: 'running' }),
    IntegrationSyncJob.countDocuments({ status: 'failed' }),
    StellarActivityScan.countDocuments({ status: 'queued' }),
    StellarActivityScan.countDocuments({ status: 'running' }),
    StellarActivityScan.countDocuments({ status: 'failed' }),
    SorobanTransactionEvidence.countDocuments({ rpcStatus: 'queued' }),
    SorobanTransactionEvidence.countDocuments({ rpcStatus: 'running' }),
    SorobanTransactionEvidence.countDocuments({ rpcStatus: 'failed' }),
    IntegrationSyncJob.findOne({ status: 'queued' }).sort({ createdAt: 1 }).select('createdAt'),
    StellarActivityScan.findOne({ status: 'queued' }).sort({ createdAt: 1 }).select('createdAt'),
    SorobanTransactionEvidence.findOne({ rpcStatus: 'queued' }).sort({ createdAt: 1 }).select('createdAt'),
    SorobanTransactionEvidence.countDocuments({ rpcStatus: 'unavailable' }),
  ]);
  const dates = [oldestSync?.createdAt, oldestScan?.createdAt, oldestEvidence?.createdAt].filter((date): date is Date =>
    date instanceof Date);
  const oldestPendingAgeSeconds = dates.length > 0
    ? Math.max(0, Math.floor((Date.now() - Math.min(...dates.map((date) => date.getTime()))) / 1_000))
    : null;

  const failedJobs = failedSync + failedScans + failedEvidence;
  return {
    ready: true,
    mongoReady,
    rabbitmqReady,
    queuedJobs: queuedSync + queuedScans + queuedEvidence,
    runningJobs: runningSync + runningScans + runningEvidence,
    failedJobs,
    oldestPendingAgeSeconds,
    unavailableEvidence,
    needsAttention: !rabbitmqReady || failedJobs > 0 || unavailableEvidence > 0 ||
      (oldestPendingAgeSeconds !== null && oldestPendingAgeSeconds > 300),
  };
};

export default getOperationalStatus;
