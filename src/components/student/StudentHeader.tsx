import { useEffect, useState } from 'react';
import { navigateLegacy, type LegacyPage } from '../../app/legacyRouter';
import { useStudentAuth } from '../../features/auth/session/AuthSessionProvider';
import { formatNotificationDate } from '../../features/notifications/notificationModel';
import { listMyNotifications, markMyNotificationsRead } from '../../features/notifications/notificationService';
import type { AppNotification } from '../../features/notifications/types';

interface HeaderNotification { id:string; title:string; message:string; date:string; read:boolean }

interface StudentHeaderProps {
  activePage: LegacyPage;
  user?: { name?:string; email?:string; avatarUrl?:string };
  notifications?: HeaderNotification[];
}

export default function StudentHeader({ activePage, user, notifications }: StudentHeaderProps) {
  const auth = useStudentAuth();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [liveNotifications, setLiveNotifications] = useState<AppNotification[]>([]);
  const [liveUnreadCount, setLiveUnreadCount] = useState(0);
  const [markingRead, setMarkingRead] = useState(false);

  const authUser = auth.session ? {
    name: auth.profile?.fullName || 'Học sinh',
    email: auth.session.user.email || '',
    avatarUrl: undefined as string | undefined,
  } : null;
  const resolvedUser = user ?? authUser ?? { name:'Học sinh', email:'', avatarUrl:undefined };

  const isHomePage = ['index', 'detail', 'add'].includes(activePage);
  const isMyPostsPage = ['myPosts', 'myDetail', 'editPost'].includes(activePage);
  const isProfilePage = activePage === 'profile';

  useEffect(() => {
    if (notifications) return;
    if (!auth.session) {
      setLiveNotifications([]);
      setLiveUnreadCount(0);
      return;
    }

    let isMounted = true;
    listMyNotifications({ limit: 10 })
      .then((res) => {
        if (isMounted) {
          setLiveNotifications(res.items);
          setLiveUnreadCount(res.unreadCount);
        }
      })
      .catch((err) => {
        console.warn('Could not load notifications', err);
      });

    return () => {
      isMounted = false;
    };
  }, [auth.session, notifications]);

  const handleMarkAllRead = async () => {
    if (markingRead) return;
    setMarkingRead(true);
    try {
      await markMyNotificationsRead();
      setLiveUnreadCount(0);
      setLiveNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
      );
    } catch (err) {
      console.error('Failed to mark notifications read', err);
    } finally {
      setMarkingRead(false);
    }
  };

  const resolvedNotifications: HeaderNotification[] = notifications ?? (liveNotifications.length ? liveNotifications.map((n) => ({
    id: n.id,
    title: n.title,
    message: n.body,
    date: formatNotificationDate(n.createdAt),
    read: Boolean(n.readAt),
  })) : notifications ?? []);

  const unreadCount = notifications ? notifications.filter((item) => !item.read).length : liveUnreadCount;

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);

    try {
      await auth.signOut();
      navigateLegacy('landing');
    } catch (error) {
      console.error('EDU SHARE+ sign out failed', error);
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <>
      <header className="app-header student-app-header">
        <button className="brand" type="button" onClick={() => navigateLegacy('index')}>
          <span className="brand-mark">E+</span>
          <span className="brand-title-wrap">
            <span className="brand-name-line">Edu Share+ <span className="brand-audience-badge">HỌC SINH</span></span>
            <small>Sàn trao đổi &amp; chia sẻ đồ dùng học tập #1</small>
          </span>
        </button>

        <div className="nav-actions">
          <button className="hello student-user-summary profile-trigger" type="button" title="Mở hồ sơ cá nhân" onClick={() => navigateLegacy('profile')}>
            <span className={`avatar${resolvedUser.avatarUrl ? ' has-photo' : ''}`} style={resolvedUser.avatarUrl ? { backgroundImage:`url("${resolvedUser.avatarUrl}")` } : undefined}>{resolvedUser.avatarUrl ? '' : '?'}</span>
            <span className="header-user-copy">
              <strong className="header-user-name">{resolvedUser.name || 'Học sinh'}</strong>
              <small className="header-user-email">{resolvedUser.email || ''}</small>
            </span>
          </button>

          <button className="nav-btn notify-btn student-notify-btn" type="button" title="Thông báo" aria-label="Thông báo" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((value) => !value)}>
            <span className="notify-badge" style={{ display:unreadCount ? 'inline-flex' : 'none' }}>{unreadCount || ''}</span>
          </button>

          <button className={`nav-btn student-nav-link profile-nav-btn${isProfilePage ? ' active' : ''}`} type="button" onClick={() => navigateLegacy('profile')}>Hồ sơ</button>
          <button className={`nav-btn student-nav-link${isHomePage ? ' active' : ''}`} type="button" onClick={() => navigateLegacy('index')}>Trang chủ</button>
          <button className={`nav-btn student-nav-link${isMyPostsPage ? ' active' : ''}`} type="button" onClick={() => navigateLegacy('myPosts')}>Bài của tôi</button>
          <button className="nav-btn student-nav-link student-logout-btn" type="button" disabled={loggingOut} onClick={() => void handleLogout()}>{loggingOut ? 'Đang thoát...' : 'Đăng xuất'}</button>
        </div>
      </header>

      <aside className="notify-panel" style={{ display: notificationsOpen ? 'block' : 'none' }} aria-hidden={!notificationsOpen}>
        <div className="notify-head">
          <span>Thông báo</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {unreadCount > 0 && (
              <button
                type="button"
                className="btn-mark-read"
                style={{ background: 'none', border: 'none', color: '#1a73e8', cursor: 'pointer', fontSize: '12px' }}
                onClick={handleMarkAllRead}
                disabled={markingRead}
              >
                {markingRead ? 'Đang lưu...' : 'Đọc tất cả'}
              </button>
            )}
            <button type="button" onClick={() => setNotificationsOpen(false)}>Đóng</button>
          </div>
        </div>
        <div className="notify-list">
          {resolvedNotifications.length ? resolvedNotifications.slice(0,8).map((item) => (
            <div className={`notify-item${item.read ? '' : ' unread'}`} key={item.id}>
              <div className="notify-title">{item.title}</div>
              <div className="notify-msg">{item.message}</div>
              <div className="notify-date">{item.date}</div>
            </div>
          )) : <div className="notify-empty">Chưa có thông báo mới.</div>}
        </div>
      </aside>
    </>
  );
}
