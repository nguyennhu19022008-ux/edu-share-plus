import { generateRecommendations } from '../recommendations/recommendationService';
import { evaluatePostOwnerReputation } from '../reputation/reputationService';
import type { MarketplaceReadResponse } from './marketplaceReadModel';
import type { MarketPost, MarketplaceReadPost, SmartMode } from './types';

export interface MarketplaceSmartOptions {
  smartMode?: SmartMode;
  studentClassLabel?: string | null;
  gradeLevel?: string | null;
}

export function buildSmartMarketplacePosts(
  items: MarketplaceReadPost[],
  options?: MarketplaceSmartOptions,
): MarketPost[] {
  if (!items.length) return [];

  const mode = options?.smartMode ?? 'off';
  const recommendations = generateRecommendations(items, {
    className: options?.studentClassLabel ?? null,
    gradeLevel: options?.gradeLevel ?? null,
  });
  const recMap = new Map(recommendations.map((rec) => [rec.id, rec]));

  const enriched: MarketPost[] = items.map((post) => {
    const repEval = evaluatePostOwnerReputation(post);
    const rec = recMap.get(post.id);
    const aiScore = rec ? rec.score : 50;
    const explanationTag = rec?.explanationTag || 'Gợi ý học liệu';
    const aiReason = rec
      ? `${rec.explanationTag} — ${rec.explanationReason}`
      : 'Phù hợp với nhu cầu học tập phổ biến trong trường.';

    return {
      ...post,
      ownerReputationScore: repEval.normalizedOwnerScore,
      rankScore: repEval.rankScore,
      aiScore,
      reputationBadgeLabel: repEval.reputationSummary.badgeLabel,
      explanationTag,
      recommendationReason: mode === 'rank' ? repEval.reason : aiReason,
    };
  });

  if (mode === 'ai') {
    return [...enriched].sort(
      (a, b) => b.aiScore - a.aiScore || b.rankScore - a.rankScore || b.dateTs - a.dateTs,
    );
  }

  return [...enriched].sort(
    (a, b) =>
      b.rankScore - a.rankScore ||
      b.ownerReputationScore - a.ownerReputationScore ||
      b.favoriteCount - a.favoriteCount ||
      b.dateTs - a.dateTs,
  );
}

export function deriveMarketplacePageState(
  response: MarketplaceReadResponse,
  options?: MarketplaceSmartOptions,
) {
  const safePage = response.totalPages > 0
    ? Math.min(Math.max(1, response.page), response.totalPages)
    : 1;
  const smartMode = options?.smartMode ?? 'off';
  const smartPosts = buildSmartMarketplacePosts(response.items, options);
  const posts = smartMode === 'off' ? response.items : smartPosts;

  return {
    posts,
    smartPosts,
    totalCount: response.totalCount,
    totalPages: response.totalPages,
    safePage,
    stats: response.stats,
    classes: response.classes,
    categories: response.categories,
  };
}

