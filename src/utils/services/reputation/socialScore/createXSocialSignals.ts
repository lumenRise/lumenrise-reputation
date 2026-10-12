import type { XDataSnapshotDocument } from '../../../../types/reputation/x';
import type { SocialSignalInput } from '../../../../types/reputation/socialScoring';
import {
  SOCIAL_PROFILE_WEIGHT,
  SOCIAL_NETWORK_WEIGHT,
  X_PROFILE_SIGNALS,
  X_PRIORITY_WEIGHTS,
  X_CONNECTION_WEIGHTS,
  X_SOCIAL_CATEGORIES,
} from '../../../../constants/services/reputation/socialScore';

const createXSocialSignals = (snapshot: XDataSnapshotDocument): SocialSignalInput[] => {
  const observedAt = snapshot.collectedAt;
  const metrics = snapshot.metrics;
  const signals: SocialSignalInput[] = X_PROFILE_SIGNALS.map((signal) => ({
    key: signal.key,
    rawValue: metrics[signal.metric],
    baseWeight: SOCIAL_PROFILE_WEIGHT * signal.weight,
    scale: signal.scale,
    normalization: 'diminishing_returns',
    observedAt,
  }));

  const connections = new Map(
    (snapshot.connections ?? []).map((connection) => [
      connection.username.toLowerCase(),
      connection.connectionStatus,
    ]),
  );

  for (const category of X_SOCIAL_CATEGORIES) {
    const totalPriority = category.accounts.reduce(
      (total, account) => total + X_PRIORITY_WEIGHTS[account.priority],
      0,
    );

    for (const account of category.accounts) {
      const statuses = connections.get(account.username.toLowerCase()) ?? [];

      const rawValue =
        (statuses.includes('following') ? X_CONNECTION_WEIGHTS.following : 0) +
        (statuses.includes('followed_by')
          ? X_CONNECTION_WEIGHTS.followed_by
          : 0);

      signals.push({
        key: `${category.key}:${account.username}`,
        rawValue,
        baseWeight:
          (SOCIAL_NETWORK_WEIGHT *
            category.weight *
            X_PRIORITY_WEIGHTS[account.priority]) /
          totalPriority,
        scale: 1,
        normalization: 'linear',
        observedAt,
      });
    }
  }

  return signals;
};

export { createXSocialSignals };
