import { getSupabaseClient } from '../../lib/supabase/client';
import { parseNotificationListResult } from './notificationModel';
import type { NotificationListResult } from './types';

export async function listMyNotifications(params?: {
  limit?: number;
  offset?: number;
}): Promise<NotificationListResult> {
  const client = getSupabaseClient();
  const limit = params?.limit ?? 20;
  const offset = params?.offset ?? 0;

  const { data, error } = await client.rpc('list_my_notifications', {
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    if (error.message.includes('schema cache') || error.message.includes('not find the function')) {
      return { items: [], unreadCount: 0, totalCount: 0, limit, offset };
    }
    throw new Error(error.message || 'Không thể tải danh sách thông báo.');
  }

  return parseNotificationListResult(data);
}

export async function markMyNotificationsRead(notificationIds?: string[]): Promise<number> {
  const client = getSupabaseClient();

  const { data, error } = await client.rpc('mark_my_notifications_read', {
    p_notification_ids: notificationIds && notificationIds.length > 0 ? notificationIds : null,
  });

  if (error) {
    if (error.message.includes('schema cache') || error.message.includes('not find the function')) {
      return 0;
    }
    throw new Error(error.message || 'Không thể đánh dấu đã đọc thông báo.');
  }

  return typeof data === 'number' ? data : 0;
}
