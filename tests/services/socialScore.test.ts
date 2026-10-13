import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';

import XDataSnapshot from '../../src/models/XDataSnapshot';
import ReputationSnapshot from '../../src/models/ReputationSnapshot';
import { X_SOCIAL_CATEGORIES } from '../../src/constants/services/reputation/socialScore';
import {
  calculateSocialScore,
  createXSocialSignals,
  normalizeSocialSignal,
} from '../../src/services/reputation/socialScore';

const createSnapshot = (postsCollected: boolean) =>
  new XDataSnapshot({
    identity: new Types.ObjectId(),
    externalAccount: new Types.ObjectId(),
    providerAccountId: '42',
    username: 'developer',
    status: postsCollected ? 'complete' : 'partial',
    dataVersion: 'x-data-v1',
    coverage: { profile: true, posts: postsCollected },
    metrics: {
      accountAgeDays: 1_000,
      followerCount: 500,
      followingCount: 100,
      reportedPostCount: 1_000,
      listedCount: 20,
      profileLikeCount: 200,
      mediaCount: 50,
      collectedPostCount: postsCollected ? 1_000 : 0,
      originalPostCount: postsCollected ? 500 : 0,
      replyPostCount: postsCollected ? 200 : 0,
      repostCount: postsCollected ? 200 : 0,
      quotePostCount: postsCollected ? 100 : 0,
      activeDayCount: postsCollected ? 300 : 0,
      receivedRepostCount: postsCollected ? 500 : 0,
      receivedReplyCount: postsCollected ? 600 : 0,
      receivedLikeCount: postsCollected ? 5_000 : 0,
      receivedQuoteCount: postsCollected ? 100 : 0,
      receivedBookmarkCount: postsCollected ? 300 : 0,
      impressionCount: postsCollected ? 20_000 : 0,
    },
    activityFrom: null,
    activityTo: new Date('2026-09-23T12:00:00.000Z'),
    collectedAt: new Date('2026-09-23T12:00:00.000Z'),
  });

describe('social reputation scoring', () => {
  it('normalizes increasing raw values without an arbitrary count cutoff', () => {
    const atScale = normalizeSocialSignal(100, 100);
    const aboveScale = normalizeSocialSignal(200, 100);

    expect(normalizeSocialSignal(0, 100)).toBe(0);
    expect(atScale).toBeCloseTo(63.2121, 4);
    expect(aboveScale).toBeGreaterThan(atScale);
    expect(() => normalizeSocialSignal(-1, 100)).toThrow();
  });

  it('allocates 75 profile points and 225 network points without redistributing missing data', () => {
    const snapshot = createSnapshot(false);
    const inputs = createXSocialSignals(snapshot);
    const result = calculateSocialScore(inputs);

    expect(inputs).toHaveLength(43);
    expect(inputs.slice(0, 3).map((input) => input.baseWeight * 300)).toEqual([22.5, 30, 22.5]);
    expect(inputs[0]?.scale).toBe(365);
    expect(result.signals.reduce((total, signal) => total + signal.weight, 0)).toBeCloseTo(1, 10);
    expect(result.signals.slice(3).every((signal) => signal.contribution === 0)).toBe(true);
    expect(result.score).toBeLessThanOrEqual(75);
  });

  it('awards 40%, 60% and 100% of the same account allocation', () => {
    const snapshot = createSnapshot(true);
    const points: number[] = [];
    for (const statuses of [[], ['following'], ['followed_by'], ['following', 'followed_by']]) {
      snapshot.connections = [{ username: 'stellarorg', connectionStatus: statuses }];
      const signal = calculateSocialScore(createXSocialSignals(snapshot)).signals[3];
      points.push(signal?.contribution ?? 0);
    }
    expect(points[0]).toBe(0);
    expect(points[1]).toBeCloseTo(3.796875, 4);
    expect(points[2]).toBeCloseTo(5.6953125, 4);
    expect(points[3]).toBeCloseTo(9.4921875, 4);
  });

  it('preserves category budgets and the 1.5 priority ratio', () => {
    const inputs = createXSocialSignals(createSnapshot(true));
    for (const category of X_SOCIAL_CATEGORIES) {
      const signals = inputs.filter((input) => input.key.startsWith(`${category.key}:`));
      expect(signals.reduce((sum, input) => sum + input.baseWeight * 300, 0)).toBeCloseTo(
        225 * category.weight,
        10,
      );
      const accountA = category.accounts.find((account) => account.priority === 'A');
      const accountB = category.accounts.find((account) => account.priority === 'B');
      const weightA = signals.find((input) =>
        input.key.endsWith(`:${accountA?.username}`),
      )!.baseWeight;
      const weightB = signals.find((input) =>
        input.key.endsWith(`:${accountB?.username}`),
      )!.baseWeight;
      expect(weightA / weightB).toBeCloseTo(1.5, 10);
    }
  });

  it('reaches 300 only with saturated profile metrics and every mutual connection', async () => {
    const snapshot = createSnapshot(true);
    snapshot.metrics.accountAgeDays = 1_000_000;
    snapshot.metrics.followerCount = 1_000_000;
    snapshot.metrics.reportedPostCount = 1_000_000;
    snapshot.connections = X_SOCIAL_CATEGORIES.flatMap((category) =>
      category.accounts.map((account) => ({
        username: account.username,
        connectionStatus: ['following', 'followed_by'],
      })),
    );
    const result = calculateSocialScore(createXSocialSignals(snapshot));
    expect(result.score).toBe(300);
    expect(
      result.signals.slice(3).reduce((sum, signal) => sum + signal.contribution, 0),
    ).toBeCloseTo(225, 2);
    await new ReputationSnapshot({
      identity: snapshot.identity,
      category: 'social',
      status: 'complete',
      algorithmVersion: 'social-v2',
      score: result.score,
      signals: result.signals,
      calculatedAt: snapshot.collectedAt,
    }).validate();
  });

  it('does not award points for pending requests, blocks or mutes', () => {
    const snapshot = createSnapshot(true);
    snapshot.connections = [
      {
        username: 'StellarOrg',
        connectionStatus: ['follow_request_sent', 'blocking', 'muting'],
      },
    ];
    expect(calculateSocialScore(createXSocialSignals(snapshot)).signals[3]?.contribution).toBe(0);
  });
});
