import XRateLimitError from '../../../../services/integration/xRateLimit';
import XApiResponseError from '../../../../services/integration/xApiResponseError';
import { X_SOCIAL_CATEGORIES } from '../../../../constants/services/reputation/socialScore';
import type {
  XAccountConnection,
  XConnectionResponse,
} from '../../../../types/reputation/x';

const collectXConnections = async (
  accessToken: string,
): Promise<XAccountConnection[]> => {
  const accounts = X_SOCIAL_CATEGORIES.flatMap((category) => [
    ...category.accounts,
  ]);

  const url = new URL('https://api.x.com/2/users/by');

  url.searchParams.set(
    'usernames',
    accounts.map((account) => account.username).join(','),
  );

  url.searchParams.set('user.fields', 'connection_status');

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status === 429) {
    throw new XRateLimitError(response);
  }

  const result = (await response.json()) as XConnectionResponse;

  if (!response.ok) {
    throw new XApiResponseError(
      response.status,
      'connection lookup',
      result.errors?.[0]?.detail ??
        result.errors?.[0]?.title ??
        result.detail ??
        result.title ??
        'Unknown X API error',
    );
  }

  const users = new Map(
    (result.data ?? []).map((user) => [user.username.toLowerCase(), user]),
  );

  return accounts.map((account) => {
    const statuses = users.get(
      account.username.toLowerCase(),
    )?.connection_status;

    return {
      username: account.username,
      connectionStatus:
        Array.isArray(statuses) &&
        statuses.every((status) => typeof status === 'string')
          ? statuses
          : [],
    };
  });
};

export { collectXConnections };
