import { useEffect, useState } from 'react';
import {
  listSchoolStaffNotifications,
  markAllStaffNotificationsAsRead,
  markStaffNotificationAsRead,
} from '../teacherNotificationService';
import type { StaffNotification } from '../teacherNotificationTypes';

interface TeacherNotificationHubProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAction?: (target: string) => void;
}

export function TeacherNotificationHub({
  isOpen,
  onClose,
  onSelectAction,
}: TeacherNotificationHubProps) {
  const [notifications, setNotifications] = useState<StaffNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await listSchoolStaffNotifications({ limit: 30 });
      setNotifications(res.items);
      setUnreadCount(res.unreadCount);
    } catch {
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadNotifications();
  }, []);

  const handleMarkAllRead = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await markAllStaffNotificationsAsRead();
      setUnreadCount(0);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
      );
    } finally {
      setBusy(false);
    }
  };

  const handleItemClick = async (item: StaffNotification) => {
    if (!item.readAt) {
      void markStaffNotificationAsRead(item.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    if (onSelectAction && item.linkTarget) {
      onSelectAction(item.linkTarget);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="admin-moderation-card" style={{ marginBottom: '1.5rem', border: '2px solid var(--accent, #ee4d2d)' }}>
      <div className="admin-moderation-header">
        <div className="admin-moderation-title-row">
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🔔</span>
              <span>Trung tâm Thông báo Giáo viên & Quản trị</span>
              {unreadCount > 0 && (
                <span
                  style={{
                    backgroundColor: '#ee4d2d',
                    color: '#fff',
                    fontSize: '0.75rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '999px',
                    fontWeight: 'bold',
                  }}
                >
                  {unreadCount} mới
                </span>
              )}
            </h2>
            <p>Nhận thông báo tức thì khi có học sinh đăng ký tài khoản mới hoặc đăng bài lên Chợ.</p>
          </div>

          <div className="admin-moderation-actions">
            <button
              className="admin-outline-button compact"
              type="button"
              disabled={busy || loading}
              onClick={() => void loadNotifications()}
            >
              Làm mới
            </button>
            {unreadCount > 0 && (
              <button
                className="admin-outline-button compact"
                type="button"
                disabled={busy}
                onClick={() => void handleMarkAllRead()}
              >
                Đọc tất cả
              </button>
            )}
            <button
              className="admin-outline-button compact"
              type="button"
              onClick={onClose}
            >
              Đóng
            </button>
          </div>
        </div>
      </div>

      <div className="admin-content">
        {loading ? (
          <div className="state admin-empty-state">Đang tải thông báo giáo viên...</div>
        ) : notifications.length === 0 ? (
          <div className="state admin-empty-state">
            Hiện chưa có thông báo mới. Khi học sinh đăng ký hoặc đăng bài, hệ thống sẽ tự động cập nhật tại đây!
          </div>
        ) : (
          <div className="admin-table-scroll">
            <table className="admin-review-table">
              <thead>
                <tr>
                  <th>Loại</th>
                  <th>Tiêu đề</th>
                  <th>Nội dung chi tiết</th>
                  <th>Thời gian</th>
                  <th>Trạng thái</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {notifications.map((item) => {
                  const isUnread = !item.readAt;
                  const icon =
                    item.type === 'student_registration'
                      ? '📋'
                      : item.type === 'post_created'
                      ? '📦'
                      : item.type === 'post_reported'
                      ? '🚨'
                      : 'ℹ️';

                  return (
                    <tr
                      key={item.id}
                      style={{
                        backgroundColor: isUnread ? 'rgba(238, 77, 45, 0.05)' : undefined,
                        cursor: 'pointer',
                      }}
                      onClick={() => void handleItemClick(item)}
                    >
                      <td style={{ fontSize: '1.25rem' }}>{icon}</td>
                      <td>
                        <strong>{item.title}</strong>
                      </td>
                      <td>{item.body}</td>
                      <td>
                        <small className="meta">
                          {new Date(item.createdAt).toLocaleString('vi-VN')}
                        </small>
                      </td>
                      <td>
                        <span
                          className="admin-status-pill"
                          style={{
                            backgroundColor: isUnread ? '#ffebe7' : '#f1f5f9',
                            color: isUnread ? '#d73211' : '#64748b',
                            borderColor: isUnread ? '#ffc4b8' : '#cbd5e1',
                          }}
                        >
                          {isUnread ? 'Chưa đọc' : 'Đã xem'}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="admin-table-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleItemClick(item);
                          }}
                        >
                          Xem việc cần làm
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
