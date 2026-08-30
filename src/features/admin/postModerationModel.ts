import type {
  StaffPostQueueItem,
  StaffPostsQueueResult,
  StaffReportQueueItem,
  StaffReportsQueueResult,
} from './postModerationTypes';

export function parseStaffPostQueueItem(raw: unknown): StaffPostQueueItem {
  if (!raw || typeof raw !== 'object') {
    throw new Error('EDU_SHARE_STAFF_POST_ROW_INVALID');
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.id !== 'string' || !obj.id.trim()) {
    throw new Error('EDU_SHARE_STAFF_POST_ID_INVALID');
  }

  if (typeof obj.title !== 'string') {
    throw new Error('EDU_SHARE_STAFF_POST_TITLE_INVALID');
  }

  const price = Number(obj.price ?? 0);

  return {
    id: obj.id.trim(),
    title: obj.title.trim(),
    description: typeof obj.description === 'string' ? obj.description.trim() : '',
    tradeType: typeof obj.tradeType === 'string' ? obj.tradeType.trim() : 'lend',
    category: typeof obj.category === 'string' ? obj.category.trim() : null,
    className: typeof obj.className === 'string' ? obj.className.trim() : null,
    ownerName: typeof obj.ownerName === 'string' && obj.ownerName.trim() ? obj.ownerName.trim() : 'Học sinh',
    ownerEmail: typeof obj.ownerEmail === 'string' ? obj.ownerEmail.trim() : null,
    price: Number.isNaN(price) ? 0 : price,
    moderationStatus: (['pending', 'approved', 'rejected'].includes(String(obj.moderationStatus))
      ? String(obj.moderationStatus)
      : 'pending') as StaffPostQueueItem['moderationStatus'],
    lifecycleStatus: typeof obj.lifecycleStatus === 'string' ? obj.lifecycleStatus.trim() : 'active',
    isHidden: Boolean(obj.isHidden),
    commentsEnabled: obj.commentsEnabled !== false,
    rejectionReason: typeof obj.rejectionReason === 'string' ? obj.rejectionReason.trim() : null,
    createdAt: typeof obj.createdAt === 'string' ? obj.createdAt.trim() : new Date().toISOString(),
    publishedAt: typeof obj.publishedAt === 'string' ? obj.publishedAt.trim() : null,
    reportCount: Number(obj.reportCount ?? 0) || 0,
    favoriteCount: Number(obj.favoriteCount ?? 0) || 0,
  };
}

export function parseStaffPostsQueueResult(raw: unknown): StaffPostsQueueResult {
  if (!raw || typeof raw !== 'object') {
    throw new Error('EDU_SHARE_STAFF_POSTS_RESULT_INVALID');
  }

  const obj = raw as Record<string, unknown>;

  if (!Array.isArray(obj.items)) {
    throw new Error('EDU_SHARE_STAFF_POSTS_ITEMS_INVALID');
  }

  const totalCount = Number(obj.totalCount ?? 0);
  const limit = Number(obj.limit ?? 20);
  const offset = Number(obj.offset ?? 0);

  return {
    items: obj.items.map(parseStaffPostQueueItem),
    totalCount: Number.isNaN(totalCount) ? 0 : totalCount,
    limit: Number.isNaN(limit) ? 20 : limit,
    offset: Number.isNaN(offset) ? 0 : offset,
  };
}

export function parseStaffReportQueueItem(raw: unknown): StaffReportQueueItem {
  if (!raw || typeof raw !== 'object') {
    throw new Error('EDU_SHARE_STAFF_REPORT_ROW_INVALID');
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.id !== 'string' || !obj.id.trim()) {
    throw new Error('EDU_SHARE_STAFF_REPORT_ID_INVALID');
  }

  return {
    id: obj.id.trim(),
    targetType: typeof obj.targetType === 'string' ? obj.targetType.trim() : 'post',
    targetId: typeof obj.targetId === 'string' ? obj.targetId.trim() : '',
    targetTitle: typeof obj.targetTitle === 'string' ? obj.targetTitle.trim() : null,
    reasonCode: typeof obj.reasonCode === 'string' ? obj.reasonCode.trim() : 'other',
    description: typeof obj.description === 'string' ? obj.description.trim() : null,
    status: (['open', 'reviewing', 'resolved', 'dismissed'].includes(String(obj.status))
      ? String(obj.status)
      : 'open') as StaffReportQueueItem['status'],
    resolutionNote: typeof obj.resolutionNote === 'string' ? obj.resolutionNote.trim() : null,
    reporterName: typeof obj.reporterName === 'string' ? obj.reporterName.trim() : 'Người dùng',
    createdAt: typeof obj.createdAt === 'string' ? obj.createdAt.trim() : new Date().toISOString(),
    resolvedAt: typeof obj.resolvedAt === 'string' ? obj.resolvedAt.trim() : null,
  };
}

export function parseStaffReportsQueueResult(raw: unknown): StaffReportsQueueResult {
  if (!raw || typeof raw !== 'object') {
    throw new Error('EDU_SHARE_STAFF_REPORTS_RESULT_INVALID');
  }

  const obj = raw as Record<string, unknown>;

  if (!Array.isArray(obj.items)) {
    throw new Error('EDU_SHARE_STAFF_REPORTS_ITEMS_INVALID');
  }

  const totalCount = Number(obj.totalCount ?? 0);
  const limit = Number(obj.limit ?? 20);
  const offset = Number(obj.offset ?? 0);

  return {
    items: obj.items.map(parseStaffReportQueueItem),
    totalCount: Number.isNaN(totalCount) ? 0 : totalCount,
    limit: Number.isNaN(limit) ? 20 : limit,
    offset: Number.isNaN(offset) ? 0 : offset,
  };
}
