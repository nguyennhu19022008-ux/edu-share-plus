export type TradeType = 'give' | 'exchange' | 'sale' | 'loan' | 'lend' | 'low_price_sale';

export type TransactionStatus = 'pending_confirmation' | 'completed' | 'cancelled';

export interface TransactionRecord {
  id: string;
  postId: string;
  ownerId: string;
  requesterId: string | null;
  schoolId: string;
  tradeType: TradeType;
  salePrice: number;
  financialSaved: number;
  wasteReducedKg: number;
  status: TransactionStatus;
  rating: number | null;
  feedbackNote: string | null;
  completedAt: string;
  createdAt: string;
}

export interface CompleteTransactionInput {
  postId: string;
  requesterId?: string | null;
  rating?: number | null;
  feedback?: string | null;
}

export interface CompleteTransactionResult {
  transactionId: string;
  postId: string;
  financialSaved: number;
  wasteReducedKg: number;
  status: string;
}

export interface SchoolImpactSummary {
  schoolId: string | null;
  completedTransactions: number;
  financialSaved: number;
  wasteReducedKg: number;
  activePosts: number;
}

export interface ItemImpactEstimate {
  financialSaved: number;
  wasteReducedKg: number;
  description: string;
}
