import type { AppNotification, NotificationListResult } from './types';

export function parseNotificationItem(raw: unknown): AppNotification {
  if (!raw || typeof raw !== 'object') {
    throw new Error('EDU_SHARE_NOTIFICATION_ROW_INVALID');
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.id !== 'string' || !obj.id.trim()) {
    throw new Error('EDU_SHARE_NOTIFICATION_ID_INVALID');
  }

  if (typeof obj.type !== 'string' || !obj.type.trim()) {
    throw new Error('EDU_SHARE_NOTIFICATION_TYPE_INVALID');
  }

  if (typeof obj.title !== 'string') {
    throw new Error('EDU_SHARE_NOTIFICATION_TITLE_INVALID');
  }

  if (typeof obj.body !== 'string') {
    throw new Error('EDU_SHARE_NOTIFICATION_BODY_INVALID');
  }

  if (typeof obj.createdAt !== 'string' || !obj.createdAt.trim()) {
    throw new Error('EDU_SHARE_NOTIFICATION_CREATED_AT_INVALID');
  }

  return {
    id: obj.id.trim(),
    type: obj.type.trim(),
    title: obj.title.trim(),
    body: obj.body.trim(),
    entityType: typeof obj.entityType === 'string' && obj.entityType.trim() ? obj.entityType.trim() : null,
    entityId: typeof obj.entityId === 'string' && obj.entityId.trim() ? obj.entityId.trim() : null,
    readAt: typeof obj.readAt === 'string' && obj.readAt.trim() ? obj.readAt.trim() : null,
    createdAt: obj.createdAt.trim(),
  };
}

export function parseNotificationListResult(raw: unknown): NotificationListResult {
  if (!raw || typeof raw !== 'object') {
    throw new Error('EDU_SHARE_NOTIFICATION_LIST_INVALID');
  }

  const obj = raw as Record<string, unknown>;

  if (!Array.isArray(obj.items)) {
    throw new Error('EDU_SHARE_NOTIFICATION_ITEMS_INVALID');
  }

  const unreadCount = Number(obj.unreadCount);
  if (Number.isNaN(unreadCount) || unreadCount < 0) {
    throw new Error('EDU_SHARE_NOTIFICATION_UNREAD_COUNT_INVALID');
  }

  const totalCount = Number(obj.totalCount);
  if (Number.isNaN(totalCount) || totalCount < 0) {
    throw new Error('EDU_SHARE_NOTIFICATION_TOTAL_COUNT_INVALID');
  }

  const limit = Number(obj.limit);
  const offset = Number(obj.offset);

  return {
    items: obj.items.map(parseNotificationItem),
    unreadCount,
    totalCount,
    limit: Number.isNaN(limit) ? 20 : limit,
    offset: Number.isNaN(offset) ? 0 : offset,
  };
}

export function formatNotificationDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return isoString;
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}
