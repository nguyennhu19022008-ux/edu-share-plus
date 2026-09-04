import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react';
import { navigateLegacy } from '../app/legacyRouter';
import StudentHeader from '../components/student/StudentHeader';
import { listMySavedPosts, setPostSaved } from '../features/interactions/interactionService';
import type { SavedPostList, SavedPostView } from '../features/interactions/interactionModel';
import { formatNotificationDate } from '../features/notifications/notificationModel';
import { listMyNotifications, markMyNotificationsRead } from '../features/notifications/notificationService';
import type { AppNotification } from '../features/notifications/types';
import {
  PrivacyLine,
  ProfileInfoCard,
  ProfileSidebar,
} from '../features/profile/components/ProfileSections';
import { validateProfilePasswordChange } from '../features/profile/profilePasswordModel';
import {
  changeMyPassword,
  getMyProfile,
  updateMyProfilePrivacy,
} from '../features/profile/profileService';
import type {
  ProfilePrivacy,
  StudentProfileView,
} from '../features/profile/types';
import { validateAvatarFile } from '../features/storage/mediaModel';
import { uploadMyAvatar } from '../features/storage/mediaService';
import { listMyTransactions } from '../features/transactions/transactionService';
import type { TransactionRecord } from '../features/transactions/transactionTypes';
import { calculateReputationScore } from '../features/reputation/reputationService';
import { formatVnd } from '../features/transactions/impactCalculator';

type MessageState = { tone:'ok' | 'error'; text:string } | null;

import { formatCurrency as formatSavedPrice, formatDateTime as formatSavedDateTime } from '../lib/formatters';

function formatSavedDate(value:string):string {
  return formatSavedDateTime(value, 'dateOnly', '');
}

function tradeLabel(value:SavedPostView['tradeType']):string {
  if (value === 'lend') return 'Cho mượn';
  if (value === 'give') return 'Tặng';
  if (value === 'exchange') return 'Trao đổi';
  return 'Bán giá rẻ';
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<StudentProfileView | null>(null);
  const [privacy, setPrivacy] = useState<ProfilePrivacy | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [privacySaving, setPrivacySaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState<MessageState>(null);
  const [message, setMessage] = useState<MessageState>(null);
  const [savedPosts, setSavedPosts] = useState<SavedPostList | null>(null);
  const [savedPostsLoading, setSavedPostsLoading] = useState(true);
  const [savedPostsError, setSavedPostsError] = useState('');
  const [unsavingPostId, setUnsavingPostId] = useState<string | null>(null);
  const [profileNotifications, setProfileNotifications] = useState<AppNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [notificationsError, setNotificationsError] = useState('');
  const [markingNotificationsRead, setMarkingNotificationsRead] = useState(false);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);

  const reputationSummary = useMemo(() => {
    return calculateReputationScore({
      isVerifiedStudent: Boolean(profile?.name),
      completedTradesCount: transactions.length,
      ratings: transactions.map((t) => t.rating).filter(Boolean) as number[],
    });
  }, [profile, transactions]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    setMessage(null);
    setSavedPostsLoading(true);
    setSavedPostsError('');
    setNotificationsLoading(true);
    setNotificationsError('');

    void listMyTransactions().then((items) => {
      if (!cancelled) setTransactions(items);
    }).catch(() => {});

    void getMyProfile()
      .then((next) => {
        if (cancelled) return;
        setProfile(next);
        setPrivacy({ ...next.privacy });
      })
      .catch((error:unknown) => {
        if (cancelled) return;
        setProfile(null);
        setPrivacy(null);
        setLoadError(
          error instanceof Error
            ? error.message
            : 'Không thể tải hồ sơ lúc này. Vui lòng thử lại.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    void listMySavedPosts(20, 0)
      .then((next) => {
        if (cancelled) return;
        setSavedPosts(next);
      })
      .catch((error:unknown) => {
        if (cancelled) return;
        setSavedPosts(null);
        setSavedPostsError(
          error instanceof Error
            ? error.message
            : 'Không thể tải bài đã lưu lúc này. Vui lòng thử lại.',
        );
      })
      .finally(() => {
        if (!cancelled) setSavedPostsLoading(false);
      });

    void listMyNotifications({ limit: 10 })
      .then((res) => {
        if (cancelled) return;
        setProfileNotifications(res.items);
      })
      .catch((err:unknown) => {
        if (cancelled) return;
        setNotificationsError(
          err instanceof Error
            ? err.message
            : 'Không thể tải thông báo lúc này.',
        );
      })
      .finally(() => {
        if (!cancelled) setNotificationsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const handlePrivacySubmit = async (event:FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!privacy || privacySaving) return;

    setPrivacySaving(true);
    setMessage(null);
    try {
      const saved = await updateMyProfilePrivacy(privacy);
      setPrivacy(saved);
      setProfile((current) => current ? { ...current, privacy:saved } : current);
      setMessage({ tone:'ok', text:'Đã lưu quyền riêng tư trên Supabase.' });
    } catch (error) {
      setMessage({
        tone:'error',
        text:error instanceof Error
          ? error.message
          : 'Không thể cập nhật quyền riêng tư lúc này.',
      });
    } finally {
      setPrivacySaving(false);
    }
  };

  const handleAvatarFileChange = (event:ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0] ?? null;
    setAvatarMessage(null);

    if (!file) {
      setAvatarFile(null);
      return;
    }

    const validationError = validateAvatarFile(file);
    if (validationError) {
      event.currentTarget.value = '';
      setAvatarFile(null);
      setAvatarMessage({ tone:'error', text:validationError });
      return;
    }

    setAvatarFile(file);
  };

  const handleAvatarSubmit = async (event:FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!avatarFile || avatarSaving) return;

    const avatarForm = event.currentTarget;
    const validationError = validateAvatarFile(avatarFile);
    if (validationError) {
      setAvatarMessage({ tone:'error', text:validationError });
      return;
    }

    setAvatarSaving(true);
    setAvatarMessage(null);
    try {
      await uploadMyAvatar(avatarFile);
      avatarForm.reset();
      setAvatarFile(null);
      setAvatarMessage({ tone:'ok', text:'Đã cập nhật ảnh đại diện riêng tư.' });
      setReloadKey((value) => value + 1);
    } catch (error) {
      setAvatarMessage({
        tone:'error',
        text:error instanceof Error ? error.message : 'Không thể cập nhật ảnh đại diện lúc này.',
      });
    } finally {
      setAvatarSaving(false);
    }
  };

  const handleUnsavePost = async (postId:string) => {
    if (unsavingPostId) return;
    setUnsavingPostId(postId);
    setSavedPostsError('');
    try {
      await setPostSaved(postId, false);
      setSavedPosts((current) => current ? {
        ...current,
        items:current.items.filter((item) => item.id !== postId),
        totalCount:Math.max(0, current.totalCount - 1),
      } : current);
      const reconciled = await listMySavedPosts(20, 0);
      setSavedPosts(reconciled);
    } catch (error) {
      setSavedPostsError(
        error instanceof Error
          ? error.message
          : 'Không thể bỏ lưu bài đăng lúc này. Vui lòng thử lại.',
      );
    } finally {
      setUnsavingPostId(null);
    }
  };

  const handlePasswordSubmit = async (event:FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (passwordSaving) return;

    const passwordForm = event.currentTarget;
    const form = new FormData(passwordForm);
    const currentPassword = String(form.get('currentPassword') || '');
    const newPassword = String(form.get('newPassword') || '');
    const confirmPassword = String(form.get('confirmPassword') || '');
    const validationError = validateProfilePasswordChange(
      currentPassword,
      newPassword,
      confirmPassword,
    );

    if (validationError) {
      setMessage({ tone:'error', text:validationError });
      return;
    }

    setPasswordSaving(true);
    setMessage(null);
    try {
      await changeMyPassword({ currentPassword, newPassword });
      passwordForm.reset();
      setMessage({ tone:'ok', text:'Đã đổi mật khẩu tài khoản bằng Supabase Auth.' });
    } catch (error) {
      setMessage({
        tone:'error',
        text:error instanceof Error
          ? error.message
          : 'Không thể đổi mật khẩu lúc này. Vui lòng thử lại.',
      });
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleMarkProfileNotificationsRead = async () => {
    if (markingNotificationsRead) return;
    setMarkingNotificationsRead(true);
    try {
      await markMyNotificationsRead();
      setProfileNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
      );
    } catch (err) {
      console.error('Failed to mark notifications read', err);
    } finally {
      setMarkingNotificationsRead(false);
    }
  };

  const headerUser = profile ? {
    name:profile.name,
    email:profile.email,
    avatarUrl:profile.avatarUrl || undefined,
  } : undefined;

  return (
    <>
      <StudentHeader activePage="profile" user={headerUser} />
      <main className="container profile-page ecom-page">
        <section className="ecom-page-title">
          <div>
            <span className="eyebrow">TÀI KHOẢN CỦA TÔI</span>
            <h1>Hồ sơ cá nhân</h1>
            <p>Xem thông tin tài khoản thật và quản lý các thiết lập đã được nối với Supabase.</p>
          </div>
          <button className="btn gray" type="button" onClick={() => navigateLegacy('index')}>Về trang chủ</button>
        </section>

        {loading ? (
          <section className="profile-shell card">
            <div className="state">Đang tải hồ sơ từ Supabase...</div>
          </section>
        ) : loadError ? (
          <section className="profile-shell card">
            <div className="state error">{loadError}</div>
            <div className="btn-row">
              <button className="btn primary" type="button" onClick={() => setReloadKey((value) => value + 1)}>Thử lại</button>
            </div>
          </section>
        ) : profile && privacy ? (
          <section className="profile-shell card">
            <div className="profile-grid profile-grid-v24">
              <ProfileSidebar profile={profile} />
              <section className="profile-main">
                <ProfileInfoCard profile={profile} />

                <div className="profile-card" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)', border: '1px solid #bbf7d0' }}>
                  <div className="profile-card-head">
                    <h3 style={{ color: '#166534' }}>🌱 Tác động Xanh & Điểm Uy tín V2</h3>
                    <span className="tag" style={{ background: '#dcfce7', color: '#15803d', fontWeight: 800 }}>
                      {reputationSummary.badgeLabel}
                    </span>
                  </div>
                  <div className="grid-2" style={{ marginTop: '10px' }}>
                    <div style={{ padding: '12px', background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      <small style={{ color: '#64748b', display: 'block' }}>Điểm tin cậy học đường</small>
                      <strong style={{ fontSize: '20px', color: '#0f172a' }}>
                        {reputationSummary.score} / 100
                      </strong>
                      <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '4px' }}>
                        ⭐ Đánh giá: {reputationSummary.averageRating} / 5 ({transactions.length} giao dịch)
                      </div>
                    </div>
                    <div style={{ padding: '12px', background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      <small style={{ color: '#64748b', display: 'block' }}>Tác động tiết kiệm & Môi trường</small>
                      <strong style={{ fontSize: '20px', color: '#16a34a' }}>
                        {formatVnd(transactions.reduce((sum, t) => sum + t.financialSaved, 0))}
                      </strong>
                      <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>
                        ♻️ Giảm ~{Number(transactions.reduce((sum, t) => sum + t.wasteReducedKg, 0).toFixed(2))} kg rác thải học tập
                      </div>
                    </div>
                  </div>
                </div>

                <form className="profile-card" onSubmit={handlePrivacySubmit}>
                  <div className="profile-card-head"><h3>Cài đặt quyền riêng tư</h3><span className="tag cat">Supabase</span></div>
                  <PrivacyLine name="showName" label="Cho phép hiển thị tên khi tính năng công khai sử dụng cờ này" checked={privacy.showName} help="Tên vẫn chỉ được hiển thị ở những luồng được backend cho phép." onChange={(checked) => setPrivacy((value) => value ? ({ ...value, showName:checked }) : value)} />
                  <PrivacyLine name="showClass" label="Cho phép hiển thị lớp khi tính năng công khai sử dụng cờ này" checked={privacy.showClass} help="Lớp vẫn chịu ràng buộc bởi phạm vi trường và chính sách marketplace." onChange={(checked) => setPrivacy((value) => value ? ({ ...value, showClass:checked }) : value)} />
                  <PrivacyLine name="showEmail" label="Cho phép dùng email trong luồng liên hệ" checked={privacy.showEmail} help="Khi bật, email chỉ có thể được trả qua luồng liên hệ được kiểm soát và có audit nếu bài đăng chọn email." onChange={(checked) => setPrivacy((value) => value ? ({ ...value, showEmail:checked }) : value)} />
                  <PrivacyLine name="showPhone" label="Cho phép dùng số điện thoại trong luồng liên hệ" checked={privacy.showPhone} help="Khi bật, số điện thoại chỉ có thể được trả qua luồng liên hệ được kiểm soát và có audit nếu bài đăng chọn số điện thoại." onChange={(checked) => setPrivacy((value) => value ? ({ ...value, showPhone:checked }) : value)} />
                  <div className="btn-row">
                    <button className="btn primary" type="submit" disabled={privacySaving}>{privacySaving ? 'Đang lưu...' : 'Lưu quyền riêng tư'}</button>
                  </div>
                </form>

                <form className="profile-card" onSubmit={handleAvatarSubmit}>
                  <div className="profile-card-head"><h3>Ảnh đại diện</h3><span className="tag">Private Storage</span></div>
                  {profile.avatarUrl ? (
                    <img className="profile-preview has-photo" src={profile.avatarUrl} alt="Ảnh đại diện hiện tại" loading="lazy" decoding="async" />
                  ) : (
                    <div className="state">Bạn chưa có ảnh đại diện.</div>
                  )}
                  <div className="field">
                    <label className="req" htmlFor="profile-avatar-file">Chọn ảnh mới</label>
                    <input
                      id="profile-avatar-file"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleAvatarFileChange}
                    />
                    <div className="form-note">JPEG, PNG hoặc WebP; tối đa 3 MiB. Ảnh được lưu trong bucket riêng tư và hiển thị bằng URL ký ngắn hạn.</div>
                  </div>
                  <div className="btn-row">
                    <button className="btn primary" type="submit" disabled={!avatarFile || avatarSaving}>{avatarSaving ? 'Đang tải ảnh…' : 'Cập nhật ảnh đại diện'}</button>
                  </div>
                  {avatarMessage ? <div className={`state ${avatarMessage.tone}`} role="status">{avatarMessage.text}</div> : null}
                  <div className="state">Ảnh nhận diện riêng vẫn chưa được mở trong Core V2.</div>
                </form>

                <div className="profile-card">
                  <div className="profile-card-head"><h3>Bài tôi đã lưu</h3><span className="tag">Supabase</span></div>
                  {savedPostsLoading ? (
                    <div className="state">Đang tải bài đã lưu...</div>
                  ) : savedPostsError ? (
                    <div className="state error">{savedPostsError}</div>
                  ) : savedPosts && savedPosts.items.length ? (
                    <>
                      <div className="meta" style={{ marginBottom:10 }}>Đang hiển thị {savedPosts.items.length} / {savedPosts.totalCount} bài bạn đã lưu và hiện còn quyền xem.</div>
                      <div className="mini-grid">
                        {savedPosts.items.map((item) => {
                          const displayDate = item.publishedAt ?? item.createdAt;
                          return (
                            <article className="mini-card" key={item.id}>
                              <b>{item.title}</b>
                              <span>{tradeLabel(item.tradeType)} • {item.categoryName}</span>
                              <small>{formatSavedPrice(item.price)} • {formatSavedDate(displayDate)}</small>
                              <small>Đã lưu bởi {item.favoriteCount} học sinh</small>
                              <div className="btn-row" style={{ marginTop:8 }}>
                                <button className="linkbtn" type="button" onClick={() => navigateLegacy('detail', { id:item.id })}>Xem chi tiết</button>
                                <button
                                  className="linkbtn danger"
                                  type="button"
                                  disabled={unsavingPostId === item.id}
                                  onClick={() => void handleUnsavePost(item.id)}
                                >
                                  {unsavingPostId === item.id ? 'Đang bỏ lưu…' : 'Bỏ lưu'}
                                </button>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="state">Bạn chưa lưu bài đăng nào đang khả dụng.</div>
                  )}
                </div>

                <form className="profile-card" onSubmit={handlePasswordSubmit}>
                  <div className="profile-card-head"><h3>Đổi mật khẩu</h3><span className="tag price">Supabase Auth</span></div>
                  <div className="field"><label className="req">Mật khẩu hiện tại</label><input name="currentPassword" type="password" required autoComplete="current-password" placeholder="Nhập mật khẩu hiện tại" /></div>
                  <div className="grid-2">
                    <div className="field"><label className="req">Mật khẩu mới</label><input name="newPassword" type="password" required minLength={8} maxLength={80} autoComplete="new-password" placeholder="Ít nhất 8 ký tự, có chữ hoa, chữ thường và số" /></div>
                    <div className="field"><label className="req">Nhập lại mật khẩu mới</label><input name="confirmPassword" type="password" required minLength={8} maxLength={80} autoComplete="new-password" placeholder="Nhập lại mật khẩu mới" /></div>
                  </div>
                  <div className="form-note strong-note">Supabase Auth sẽ kiểm tra mật khẩu hiện tại trước khi chấp nhận mật khẩu mới.</div>
                  <div className="btn-row"><button className="btn green" type="submit" disabled={passwordSaving}>{passwordSaving ? 'Đang đổi...' : 'Đổi mật khẩu'}</button></div>
                </form>

                <div className="profile-card">
                  <div className="profile-card-head">
                    <h3>Thông báo gần đây</h3>
                    <span className="tag">Phase 5H</span>
                    {profileNotifications.some((n) => !n.readAt) && (
                      <button
                        className="btn small gray"
                        type="button"
                        disabled={markingNotificationsRead}
                        onClick={handleMarkProfileNotificationsRead}
                      >
                        {markingNotificationsRead ? 'Đang lưu...' : 'Đánh dấu đã đọc'}
                      </button>
                    )}
                  </div>
                  {notificationsLoading ? (
                    <div className="state">Đang tải thông báo...</div>
                  ) : notificationsError ? (
                    <div className="state error">{notificationsError}</div>
                  ) : profileNotifications.length ? (
                    <div className="profile-notifications-list">
                      {profileNotifications.map((item) => (
                        <div className={`notify-item${item.readAt ? '' : ' unread'}`} key={item.id}>
                          <div className="notify-title">{item.title}</div>
                          <div className="notify-msg">{item.body}</div>
                          <div className="notify-date">{formatNotificationDate(item.createdAt)}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="state">Chưa có thông báo nào.</div>
                  )}
                </div>

                {message ? <div className={`state ${message.tone}`}>{message.text}</div> : null}
              </section>
            </div>
          </section>
        ) : (
          <section className="profile-shell card">
            <div className="state error">Không nhận được hồ sơ hợp lệ từ hệ thống.</div>
          </section>
        )}
      </main>
      <footer className="page-footer">Edu Share+ • Chia sẻ đồ dùng học tập an toàn trong trường</footer>
    </>
  );
}
