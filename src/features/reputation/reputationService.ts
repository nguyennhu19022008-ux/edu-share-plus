export type ReputationTier = 'bronze' | 'silver' | 'gold';

export interface ReputationSummary {
  score: number; // 0 - 100
  tier: ReputationTier;
  badgeLabel: string;
  badgeTone: 'normal' | 'good' | 'excellent';
  completedTradesCount: number;
  averageRating: number;
  isVerifiedStudent: boolean;
  breakdown: {
    verifiedBase: number;
    tradesBonus: number;
    ratingBonus: number;
    penalty: number;
  };
}

export function calculateReputationScore(params: {
  isVerifiedStudent: boolean;
  completedTradesCount: number;
  ratings?: number[];
  activeReportsCount?: number;
}): ReputationSummary {
  const verifiedBase = params.isVerifiedStudent ? 50 : 20;
  const tradesBonus = Math.min(30, (params.completedTradesCount || 0) * 10);

  let averageRating = 5;
  let ratingBonus = 15;
  if (params.ratings && params.ratings.length > 0) {
    const validRatings = params.ratings.filter((r) => r >= 1 && r <= 5);
    if (validRatings.length > 0) {
      averageRating = Number((validRatings.reduce((sum, r) => sum + r, 0) / validRatings.length).toFixed(1));
      ratingBonus = Math.round((averageRating / 5) * 20);
    }
  }

  const penalty = (params.activeReportsCount || 0) * 25;

  const score = Math.max(0, Math.min(100, verifiedBase + tradesBonus + ratingBonus - penalty));

  let tier: ReputationTier = 'bronze';
  let badgeLabel = 'Tân binh học đường';
  let badgeTone: ReputationSummary['badgeTone'] = 'normal';

  if (score >= 80) {
    tier = 'gold';
    badgeLabel = 'Đại sứ chia sẻ uy tín';
    badgeTone = 'excellent';
  } else if (score >= 60) {
    tier = 'silver';
    badgeLabel = 'Thành viên tích cực';
    badgeTone = 'good';
  }

  return {
    score,
    tier,
    badgeLabel,
    badgeTone,
    completedTradesCount: params.completedTradesCount || 0,
    averageRating,
    isVerifiedStudent: params.isVerifiedStudent,
    breakdown: {
      verifiedBase,
      tradesBonus,
      ratingBonus,
      penalty,
    },
  };
}

export interface PostReputationRankEvaluation {
  normalizedOwnerScore: number; // 0 - 10 scale
  reputationSummary: ReputationSummary;
  rankScore: number; // 0 - 100 composite ranking score
  reason: string;
}

export function evaluatePostOwnerReputation(post: {
  ownerReputationScore: number;
  ownerReputationLabel?: string | null;
  favoriteCount?: number;
  hasImage?: boolean;
  tradeType?: string;
}): PostReputationRankEvaluation {
  const rawScore = Number.isFinite(post.ownerReputationScore) ? post.ownerReputationScore : 5;
  const normalizedOwnerScore = rawScore > 10
    ? Number(Math.min(10, Math.max(0, rawScore / 10)).toFixed(1))
    : Number(Math.min(10, Math.max(0, rawScore)).toFixed(1));

  const isVerifiedStudent = normalizedOwnerScore >= 4;
  const estimatedTrades = Math.max(0, Math.round((normalizedOwnerScore - 5) * 1.5));
  const estimatedRating = Number(Math.min(5, Math.max(3.5, normalizedOwnerScore / 2)).toFixed(1));

  const reputationSummary = calculateReputationScore({
    isVerifiedStudent,
    completedTradesCount: estimatedTrades,
    ratings: [estimatedRating],
  });

  const repBase = Math.round(normalizedOwnerScore * 6 + reputationSummary.score * 0.2);
  const favoriteCount = Math.max(0, post.favoriteCount || 0);
  const favBonus = Math.min(16, favoriteCount * 2);
  const imageBonus = post.hasImage ? 7 : 0;
  const isFreeShare = post.tradeType === 'Cho tặng' || post.tradeType === 'give';
  const isLendShare = post.tradeType === 'Cho mượn' || post.tradeType === 'lend';
  const shareBonus = isFreeShare ? 5 : isLendShare ? 3 : 0;

  const rankScore = Math.max(10, Math.min(99, repBase + favBonus + imageBonus + shareBonus));
  const scoreDisplay = Number.isInteger(normalizedOwnerScore)
    ? String(normalizedOwnerScore)
    : normalizedOwnerScore.toFixed(1);

  const parts = [
    `${reputationSummary.badgeLabel} (${scoreDisplay}/10)`,
    `${favoriteCount} lượt lưu`,
  ];
  if (post.hasImage) {
    parts.push('Có ảnh thực tế');
  }

  return {
    normalizedOwnerScore,
    reputationSummary,
    rankScore,
    reason: parts.join(' • '),
  };
}

