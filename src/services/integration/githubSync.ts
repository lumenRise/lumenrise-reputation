import ExternalAccount from '../../models/ExternalAccount';
import { collectGitHubData } from '../reputation/githubData';
import GitHubDataSnapshot from '../../models/GitHubDataSnapshot';
import GitHubRepositoryFact from '../../models/GitHubRepositoryFact';
import type { GitHubSyncOutcome } from '../../types/integration/sync';
import type { ExternalAccountDocument } from '../../types/integration/model';
import { calculateAndStoreDeveloperReputation } from '../reputation/developerScore';
import { TOKEN_REFRESH_WINDOW_MS } from '../../constants/services/integration/githubSync';
import {
  GITHUB_SYNC_LEASE_MS,
  GITHUB_SYNC_MIN_INTERVAL_MS,
} from '../../constants/integration';
import { getRetryAfterSeconds } from '../../utils/services/integration/githubSync/getRetryAfterSeconds';
import { getAuthenticatedGitHubUser } from '../../utils/services/oauth/github/getAuthenticatedGitHubUser';
import { needsCredentialRefresh } from '../../utils/services/integration/githubSync/needsCredentialRefresh';
import { resolveGitHubAccessToken } from '../../utils/services/integration/githubSync/resolveGitHubAccessToken';

const syncGitHubAccount = async (
  account: ExternalAccountDocument,
  now = new Date(),
): Promise<GitHubSyncOutcome> => {
  const nextSyncAt = account.lastSyncedAt
    ? new Date(account.lastSyncedAt.getTime() + GITHUB_SYNC_MIN_INTERVAL_MS)
    : now;

  if (nextSyncAt > now) {
    return {
      state: 'too_recent',
      retryAfterSeconds: getRetryAfterSeconds(nextSyncAt, now),
    };
  }

  const syncLeaseUntil = new Date(now.getTime() + GITHUB_SYNC_LEASE_MS);

  const leasedAccount = await ExternalAccount.findOneAndUpdate(
    {
      _id: account._id,
      status: 'connected',
      $or: [{ syncLeaseUntil: null }, { syncLeaseUntil: { $lte: now } }],
      lastSyncedAt: account.lastSyncedAt,
    },
    { $set: { syncLeaseUntil } },
    { returnDocument: 'after' },
  );

  if (!leasedAccount) {
    const currentAccount = await ExternalAccount.findById(account._id).select(
      'lastSyncedAt syncLeaseUntil',
    );
    const retryAt =
      currentAccount?.syncLeaseUntil ?? new Date(now.getTime() + 1_000);

    return {
      state: 'in_progress',
      retryAfterSeconds: getRetryAfterSeconds(retryAt, now),
    };
  }

  try {
    const accessToken = await resolveGitHubAccessToken(leasedAccount._id);

    if (!accessToken) {
      return { state: 'reauthorization_required' };
    }

    const user = await getAuthenticatedGitHubUser(accessToken);

    if (user.id.toString() !== leasedAccount.providerAccountId) {
      throw new Error(
        'Stored GitHub credential does not match the connected account',
      );
    }

    const snapshot = await collectGitHubData(
      leasedAccount.identity,
      leasedAccount._id,
      user,
      accessToken,
    );

    const updateResult = await ExternalAccount.updateOne(
      { _id: leasedAccount._id, identity: leasedAccount.identity, provider: 'github',
        providerAccountId: user.id.toString(), status: 'connected', syncLeaseUntil },
      {
        $set: {
          username: user.login,
          displayName: user.name,
          profileUrl: user.html_url,
          avatarUrl: user.avatar_url,
          lastSyncedAt: snapshot.collectedAt,
        },
      },
      { runValidators: true },
    );

    if (updateResult.matchedCount === 0) {
      await Promise.all([
        GitHubRepositoryFact.deleteMany({ snapshot: snapshot._id }),
        GitHubDataSnapshot.deleteOne({ _id: snapshot._id }),
      ]);
      return { state: 'disconnected' };
    }

    const reputation = await calculateAndStoreDeveloperReputation(snapshot);
    if (!reputation) {
      await Promise.all([
        GitHubRepositoryFact.deleteMany({ snapshot: snapshot._id }),
        GitHubDataSnapshot.deleteOne({ _id: snapshot._id }),
      ]);
      return { state: 'disconnected' };
    }

    return { state: 'synchronized', snapshot };
  } finally {
    await ExternalAccount.updateOne(
      { _id: leasedAccount._id, syncLeaseUntil },
      { $set: { syncLeaseUntil: null } },
    );
  }
};

export { getRetryAfterSeconds, needsCredentialRefresh, syncGitHubAccount };

export { TOKEN_REFRESH_WINDOW_MS };
