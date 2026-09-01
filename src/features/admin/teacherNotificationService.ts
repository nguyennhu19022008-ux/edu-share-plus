import { getSupabaseClient } from '../../lib/supabase/client';
import type {
  StaffNotification,
  StaffNotificationListResult,
  StaffNotificationType,
} from './teacherNotificationTypes';

interface RawNotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  link_target?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  read_at?: string | null;
}

function mapRawNotification(row: RawNotificationRow): StaffNotification {
  return {
    id: String(row.id),
    type: (row.type as StaffNotificationType) || 'staff_alert',
    title: String(row.title || 'Thông báo quản trị'),
    body: String(row.body || ''),
    linkTarget: row.link_target ? String(row.link_target) : null,
    metadata: row.metadata || null,
    createdAt: String(row.created_at || new Date().toISOString()),
    readAt: row.read_at ? String(row.read_at) : null,
  };
}

export async function listSchoolStaffNotifications(options: {
  limit?: number;
} = {}): Promise<StaffNotificationListResult> {
  const supabase = getSupabaseClient();
  const limit = Math.min(Math.max(options.limit || 30, 1), 100);

  // 1. Try RPC first
  try {
    const { data, error } = await supabase.rpc(
      'list_school_staff_notifications',
      {
        p_limit: limit,
      },
    );

    if (!error && data && typeof data === 'object') {
      const payload = data as {
        items?: RawNotificationRow[];
        unread_count?: number;
      };
      const items = (payload.items || []).map(mapRawNotification);
      const unreadCount = Number(payload.unread_count ?? 0);
      return { items, unreadCount };
    }
  } catch {
    // Fall back to direct table query
  }

  // 2. Direct table fallback
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) {
    return { items: [], unreadCount: 0 };
  }

  const { data: rows, error: rowsError } = await supabase
    .from('notifications')
    .select('id, type, title, body, link_target, metadata, created_at, read_at')
    .eq('user_id', userId)
    .in('type', ['student_registration', 'post_created', 'post_reported', 'staff_alert'])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (rowsError || !rows) {
    return { items: [], unreadCount: 0 };
  }

  const items = (rows as RawNotificationRow[]).map(mapRawNotification);
  const unreadCount = items.filter((item) => !item.readAt).length;

  return { items, unreadCount };
}

export async function markStaffNotificationAsRead(
  notificationId: string,
): Promise<void> {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  await supabase
    .from('notifications')
    .update({ read_at: now })
    .eq('id', notificationId);
}

export async function markAllStaffNotificationsAsRead(): Promise<void> {
  const supabase = getSupabaseClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return;

  const now = new Date().toISOString();
  await supabase
    .from('notifications')
    .update({ read_at: now })
    .eq('user_id', userId)
    .is('read_at', null)
    .in('type', ['student_registration', 'post_created', 'post_reported', 'staff_alert']);
}
