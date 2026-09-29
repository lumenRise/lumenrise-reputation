import assert from 'node:assert/strict';
import { test } from 'node:test';

import { calculateDeveloperScore } from '../src/utils/services/reputation/developerScore/calculateDeveloperScore.js';
import { normalizeDiminishingReturns } from '../src/utils/services/reputation/developerScore/normalizeDiminishingReturns.js';
import { mergeStellarActivityPage, createEmptyStellarActivityAggregate } from '../src/services/stellar/mergeActivityPage.js';
import { calculateSocialScore } from '../src/utils/services/reputation/socialScore/calculateSocialScore.js';

test('developer score normalizes available weights and caps growth', () => {
  const observedAt = new Date('2026-09-23T12:00:00Z');
  const result = calculateDeveloperScore([
    { provider: 'github', key: 'repositories', rawValue: 10, baseWeight: 0.25, scale: 10, observedAt },
    { provider: 'github', key: 'commits', rawValue: 100, baseWeight: 0.75, scale: 100, observedAt },
  ], 'complete');
  assert.equal(result.score, 63.21);
  assert.deepEqual(result.signals.map((signal) => signal.weight), [0.25, 0.75]);
  assert.ok(normalizeDiminishingReturns(1_000, 100) < 100);
  assert.throws(() => calculateDeveloperScore([], 'partial'), /weighted signal/);
});

test('Stellar page merge rejects ascending scan pages and retains an empty aggregate', () => {
  const aggregate = createEmptyStellarActivityAggregate();
  const page = {
    address: 'GCFIRY65OQE7DFP5KLNS2PF2LVZMUZYJX4OZIEQ36N2IQANUB5XVYOJR',
    ownershipVerified: false,
    order: 'desc' as const,
    limit: 200,
    items: [],
    summary: { ...aggregate, scope: 'page' as const },
    nextCursor: null,
  };
  assert.deepEqual(mergeStellarActivityPage(aggregate, page, null, null).summary, aggregate);
  assert.throws(() => mergeStellarActivityPage(aggregate, { ...page, order: 'asc' }, null, null), /descending/);
});

test('social score requires weighted signals', () => {
  assert.throws(() => calculateSocialScore([]), /weighted signal/);
});
