import type { MarketplaceReadResponse } from './marketplaceReadModel';

export function deriveMarketplacePageState(response:MarketplaceReadResponse) {
  const safePage = response.totalPages > 0
    ? Math.min(Math.max(1, response.page), response.totalPages)
    : 1;
  return {
    posts:response.items,
    totalCount:response.totalCount,
    totalPages:response.totalPages,
    safePage,
    stats:response.stats,
    classes:response.classes,
    categories:response.categories,
  };
}
