export type StaffNotificationType =
  | 'student_registration'
  | 'post_created'
  | 'post_reported'
  | 'staff_alert';

export interface StaffNotification {
  id: string;
  type: StaffNotificationType;
  title: string;
  body: string;
  linkTarget?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  readAt?: string | null;
}

export interface StaffNotificationListResult {
  items: StaffNotification[];
  unreadCount: number;
}
