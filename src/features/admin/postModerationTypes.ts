export type ModerationAction =
  | 'approve'
  | 'reject'
  | 'force_hide'
  | 'force_show'
  | 'disable_comments'
  | 'enable_comments';

export interface StaffPostQueueItem {
  id: string;
  title: string;
  description: string;
  tradeType: string;
  category: string | null;
  className: string | null;
  ownerName: string;
  ownerEmail: string | null;
  price: number;
  moderationStatus: 'pending' | 'approved' | 'rejected';
  lifecycleStatus: string;
  isHidden: boolean;
  commentsEnabled: boolean;
  rejectionReason: string | null;
  createdAt: string;
  publishedAt: string | null;
  reportCount: number;
  favoriteCount: number;
}

export interface StaffPostsQueueResult {
  items: StaffPostQueueItem[];
  totalCount: number;
  limit: number;
  offset: number;
}

export interface StaffReportQueueItem {
  id: string;
  targetType: string;
  targetId: string;
  targetTitle: string | null;
  reasonCode: string;
  description: string | null;
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
  resolutionNote: string | null;
  reporterName: string;
  createdAt: string;
  resolvedAt: string | null;
}

export interface StaffReportsQueueResult {
  items: StaffReportQueueItem[];
  totalCount: number;
  limit: number;
  offset: number;
}
