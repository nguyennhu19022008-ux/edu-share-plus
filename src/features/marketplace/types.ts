export type TradeType = 'Cho mượn' | 'Cho tặng' | 'Trao đổi' | 'Bán giá rẻ';
export type SmartMode = 'off' | 'rank' | 'ai';
export type MarketSort = 'new' | 'priceAsc' | 'priceDesc' | 'image';

export interface MarketPost {
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
  rankScore: number;
  aiScore: number;
  recommendationReason: string;
}

export type MarketplaceReadPost = Omit<MarketPost, 'rankScore' | 'aiScore' | 'recommendationReason'>;

export interface MarketFilters {
  kw: string;
  trade: '' | TradeType;
  category: string;
  className: string;
  sort: MarketSort;
  smartMode: SmartMode;
}
