export type TradeType = 'Cho mượn' | 'Cho tặng' | 'Trao đổi' | 'Bán giá rẻ';
export type SmartMode = 'off' | 'rank' | 'ai';
export type MarketSort = 'new' | 'priceAsc' | 'priceDesc' | 'image';

export interface MarketPostDisplay {
  id: string;
  title: string;
  description: string;
  name: string;
  className: string;
  tradeType: TradeType;
  category: string;
  price: number;
  date: string;
  dateTs: number;
  hasImage: boolean;
  favoriteCount: number;
  ownerReputationScore: number;
  ownerReputationLabel: string;
}

/** Phase 6 smart ranking & AI recommendation shape enriched from MarketplaceReadPost. */
export interface MarketPost extends MarketPostDisplay {
  rankScore: number;
  aiScore: number;
  recommendationReason: string;
  reputationBadgeLabel?: string;
  explanationTag?: string;
}


export type MarketplaceReadPost = MarketPostDisplay;

export interface MarketFilters {
  kw: string;
  trade: '' | TradeType;
  category: string;
  className: string;
  sort: MarketSort;
  smartMode: SmartMode;
}
