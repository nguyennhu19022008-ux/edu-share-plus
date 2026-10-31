import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateReputationScore,
  evaluatePostOwnerReputation,
} from '../src/features/reputation/reputationService';

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

test('evaluatePostOwnerReputation normalizes 100-scale and 10-scale scores and computes composite rankScore', () => {
  const highEval = evaluatePostOwnerReputation({
    ownerReputationScore: 92, // 100-scale input normalized to 9.2
    favoriteCount: 6,
    hasImage: true,
    tradeType: 'Cho tặng',
  });
  assert.equal(highEval.normalizedOwnerScore, 9.2);
  assert.equal(highEval.reputationSummary.tier, 'gold');
  assert.ok(highEval.rankScore >= 85);
  assert.match(highEval.reason, /Đại sứ chia sẻ uy tín \(9\.2\/10\)/);
  assert.match(highEval.reason, /Có ảnh thực tế/);

  const lowEval = evaluatePostOwnerReputation({
    ownerReputationScore: 3.0,
    favoriteCount: 0,
    hasImage: false,
    tradeType: 'Bán giá rẻ',
  });
  assert.equal(lowEval.normalizedOwnerScore, 3);
  assert.equal(lowEval.reputationSummary.tier, 'bronze');
  assert.ok(lowEval.rankScore < highEval.rankScore);
});

