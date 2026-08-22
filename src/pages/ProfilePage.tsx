import { type ChangeEvent, type FormEvent, useEffect, useState } from 'react';
import { navigateLegacy } from '../app/legacyRouter';
import StudentHeader from '../components/student/StudentHeader';
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

type MessageState = { tone:'ok' | 'error'; text:string } | null;

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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    setMessage(null);

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

                <form className="profile-card" onSubmit={handlePrivacySubmit}>
                  <div className="profile-card-head"><h3>Cài đặt quyền riêng tư</h3><span className="tag cat">Supabase</span></div>
                  <PrivacyLine name="showName" label="Cho phép hiển thị tên khi tính năng công khai sử dụng cờ này" checked={privacy.showName} help="Tên vẫn chỉ được hiển thị ở những luồng được backend cho phép." onChange={(checked) => setPrivacy((value) => value ? ({ ...value, showName:checked }) : value)} />
                  <PrivacyLine name="showClass" label="Cho phép hiển thị lớp khi tính năng công khai sử dụng cờ này" checked={privacy.showClass} help="Lớp vẫn chịu ràng buộc bởi phạm vi trường và chính sách marketplace." onChange={(checked) => setPrivacy((value) => value ? ({ ...value, showClass:checked }) : value)} />
                  <PrivacyLine name="showEmail" label="Cho phép dùng email trong luồng liên hệ" checked={privacy.showEmail} help="Email không được công khai trực tiếp ở Phase 5D; contact reveal thật thuộc Phase 5G." onChange={(checked) => setPrivacy((value) => value ? ({ ...value, showEmail:checked }) : value)} />
                  <PrivacyLine name="showPhone" label="Cho phép dùng số điện thoại trong luồng liên hệ" checked={privacy.showPhone} help="Số điện thoại không được công khai trực tiếp ở Phase 5D; contact reveal thật thuộc Phase 5G." onChange={(checked) => setPrivacy((value) => value ? ({ ...value, showPhone:checked }) : value)} />
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
                  <div className="profile-card-head"><h3>Bài tôi đã lưu</h3><span className="tag">Phase 5G</span></div>
                  <div className="state">Danh sách yêu thích chưa được hiển thị ở đây để tránh dùng dữ liệu mẫu. Phase 5G sẽ nối nguồn favorites thật từ Supabase.</div>
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
                  <div className="profile-card-head"><h3>Thông báo gần đây</h3><span className="tag">Phase 5H</span></div>
                  <div className="state">Thông báo thật chưa được nối vào hồ sơ. Phase 5H sẽ dùng nguồn notifications trên Supabase; Phase 5D không hiển thị thông báo mẫu.</div>
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
