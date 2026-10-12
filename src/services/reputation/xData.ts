import type { Types } from 'mongoose';

import XDataSnapshot from '../../models/XDataSnapshot';
import type { XUser } from '../../types/integration/x';
import type { XDataSnapshotDocument } from '../../types/reputation/x';
import { collectXPosts } from '../../utils/services/reputation/xData/collectXPosts';
import { buildXMetrics } from '../../utils/services/reputation/xData/buildXMetrics';
import { collectXConnections } from '../../utils/services/reputation/xData/collectXConnections';
import {
  MILLISECONDS_PER_DAY,
  X_TIMELINE_PAGE_SIZE,
} from '../../constants/services/reputation/xData';

const X_DATA_VERSION = 'x-data-v2';

const collectXData = async (
  identityId: Types.ObjectId,
  externalAccountId: Types.ObjectId,
  user: XUser,
  accessToken: string,
  collectedAt = new Date(),
): Promise<XDataSnapshotDocument> => {
  const connections = await collectXConnections(accessToken);
  const metrics = buildXMetrics(user, [], collectedAt);

  return XDataSnapshot.create({
    identity: identityId,
    externalAccount: externalAccountId,
    providerAccountId: user.id,
    username: user.username,
    status: 'complete',
    dataVersion: X_DATA_VERSION,
    coverage: {
      profile: true,
      posts: false,
      connections: true,
    },
    metrics,
    connections,
    activityFrom: null,
    activityTo: collectedAt,
    collectedAt,
  });
};

export { buildXMetrics, collectXData, collectXPosts };

export { X_TIMELINE_PAGE_SIZE, MILLISECONDS_PER_DAY };
