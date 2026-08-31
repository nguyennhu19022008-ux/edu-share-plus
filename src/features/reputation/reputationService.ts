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
