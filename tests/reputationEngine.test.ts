import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateReputationScore } from '../src/features/reputation/reputationService';

test('calculateReputationScore gives base score for verified student', () => {
  const rep = calculateReputationScore({
    isVerifiedStudent: true,
    completedTradesCount: 0,
  });

  assert.ok(rep.score >= 50);
  assert.equal(rep.tier, 'silver');
});

test('calculateReputationScore reaches gold tier with multiple successful exchanges and high ratings', () => {
  const rep = calculateReputationScore({
    isVerifiedStudent: true,
    completedTradesCount: 3,
    ratings: [5, 5, 5],
  });

  assert.ok(rep.score >= 80);
  assert.equal(rep.tier, 'gold');
  assert.equal(rep.badgeLabel, 'Đại sứ chia sẻ uy tín');
});

test('calculateReputationScore applies penalty for active moderation reports', () => {
  const cleanRep = calculateReputationScore({
    isVerifiedStudent: true,
    completedTradesCount: 2,
  });

  const penalizedRep = calculateReputationScore({
    isVerifiedStudent: true,
    completedTradesCount: 2,
    activeReportsCount: 2,
  });

  assert.ok(penalizedRep.score < cleanRep.score);
});
