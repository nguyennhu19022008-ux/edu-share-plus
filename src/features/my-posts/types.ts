import type { TradeType } from '../marketplace/types';

export type MyPostStatus = 'Đang mở' | 'Chờ duyệt' | 'Từ chối' | 'Đã xong' | 'Đã thu hồi';
export type MyPostSource = 'Posts' | 'Archive';
export type MyPostSort = 'new' | 'contacts' | 'comments' | 'needAction';

export interface PostEffectiveness {
  level: 'good' | 'normal' | 'low' | 'pending' | 'warning' | 'done' | 'muted';
  label: string;
  message: string;
}

export interface MyPost {
  id: string;
  title: string;
  description: string;
  tradeType: TradeType;
  category: string;
  className: string;
  price: number;
  status: MyPostStatus;
  source: MyPostSource;
  hidden: boolean;
  date: string;
  dateTs: number;
  doneTs?: number;
  rejectionReason?: string;
  favoriteCount: number;
  contactViewCount: number;
  contactedCount: number;
  commentCount: number;
  reportCount: number;
  contactInfo?: string;
  imageUrl?: string;
}

