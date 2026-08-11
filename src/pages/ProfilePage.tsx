import { FormEvent, useMemo, useState } from 'react';
import { navigateLegacy } from '../app/legacyRouter';
import { useDataAccess } from '../app/providers/DataAccessProvider';
import StudentHeader from '../components/student/StudentHeader';
import { NotificationsSection, PrivacyLine, ProfileInfoCard, ProfileSidebar, ProfileUploadBox, SavedPostsSection } from '../features/profile/components/ProfileSections';
import type { ProfilePrivacy, StudentProfileLocal } from '../features/profile/types';

type MessageState = { tone:'ok' | 'error'; text:string } | null;

function passwordIsReasonable(value:string):boolean {
  return value.length >= 6 && /[A-Za-zÀ-ỹ]/.test(value) && /\d/.test(value);
}

export default function ProfilePage() {
  const { profile:profileRepository } = useDataAccess();
  const initial = useMemo(() => profileRepository.getBundle(), [profileRepository]);
  const [profile, setProfile] = useState<StudentProfileLocal>(initial.profile);
  const [savedPosts] = useState(initial.savedPosts);
  const [notifications, setNotifications] = useState(initial.notifications);
  const [privacy, setPrivacy] = useState<ProfilePrivacy>({ ...initial.profile.privacy });
  const [avatarDraft, setAvatarDraft] = useState(initial.profile.avatarUrl);
  const [faceDraft, setFaceDraft] = useState(initial.profile.faceUrl);
  const [avatarStatus, setAvatarStatus] = useState('Chưa chọn ảnh mới.');
  const [faceStatus, setFaceStatus] = useState('Chưa chọn ảnh mới.');
  const [message, setMessage] = useState<MessageState>(null);

  const handlePrivacySubmit = (event:FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = profileRepository.updatePrivacy(privacy);
    setProfile(next);
    setMessage({ tone:'ok', text:'Đã lưu quyền riêng tư trong phiên local.' });
  };

  const handleImagePick = (kind:'avatar'|'face', file?:File) => {
    if (!file) {
      if (kind === 'avatar') setAvatarStatus('Chưa chọn ảnh mới.');
      else setFaceStatus('Chưa chọn ảnh mới.');
      return;
    }
    if (!file.type.startsWith('image/') && !/\.(heic|heif|tif|tiff|avif|gif|bmp|svg)$/i.test(file.name)) {
      const text = 'File đã chọn không phải định dạng ảnh được chấp nhận.';
      if (kind === 'avatar') setAvatarStatus(text);
      else setFaceStatus(text);
      return;
    }
    const url = URL.createObjectURL(file);
    if (kind === 'avatar') {
      setAvatarDraft(url);
      setAvatarStatus(`Đã chọn ${file.name}. Bấm “Lưu ảnh hồ sơ” để cập nhật local.`);
    } else {
      setFaceDraft(url);
      setFaceStatus(`Đã chọn ${file.name}. Bấm “Lưu ảnh hồ sơ” để cập nhật local.`);
    }
  };

  const handleImageSave = (event:FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = profileRepository.updateImages({ avatarUrl:avatarDraft, faceUrl:faceDraft });
    setProfile(next);
    setMessage({ tone:'ok', text:'Đã lưu ảnh hồ sơ trong phiên local. Chưa có file nào được upload lên server/storage.' });
  };

  const handlePasswordSubmit = (event:FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get('currentPassword') || '');
    const newPassword = String(form.get('newPassword') || '');
    const confirmPassword = String(form.get('confirmPassword') || '');

    if (!currentPassword) {
      setMessage({ tone:'error', text:'Vui lòng nhập mật khẩu hiện tại trước khi đổi mật khẩu.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ tone:'error', text:'Mật khẩu mới nhập lại chưa khớp.' });
      return;
    }
    if (!passwordIsReasonable(newPassword)) {
      setMessage({ tone:'error', text:'Mật khẩu mới cần tối thiểu 6 ký tự và gồm cả chữ lẫn số.' });
      return;
    }

    const next = profileRepository.recordPasswordChanged();
    setProfile(next);
    setNotifications(profileRepository.getBundle().notifications);
    event.currentTarget.reset();
    setMessage({ tone:'ok', text:'Đã hoàn tất mô phỏng đổi mật khẩu local. Mật khẩu thật chưa bị thay đổi vì Auth sẽ được triển khai ở Phase 4.' });
  };

  const handleReadAll = () => {
    setNotifications(profileRepository.markAllNotificationsRead());
    setMessage({ tone:'ok', text:'Đã đánh dấu tất cả thông báo là đã đọc trong phiên local.' });
  };

  return (
    <>
      <StudentHeader activePage="profile" user={{ name:profile.name, email:profile.email, avatarUrl:profile.avatarUrl }} notifications={notifications} />
      <main className="container profile-page ecom-page">
        <section className="ecom-page-title">
          <div>
            <span className="eyebrow">TÀI KHOẢN CỦA TÔI</span>
            <h1>Hồ sơ cá nhân</h1>
            <p>Quản lý thông tin, quyền riêng tư, ảnh hồ sơ, bài đã lưu, thông báo và mật khẩu.</p>
          </div>
          <button className="btn gray" type="button" onClick={() => navigateLegacy('index')}>Về trang chủ</button>
        </section>

        <section className="profile-shell card">
          <div className="profile-grid profile-grid-v24">
            <ProfileSidebar profile={profile} />
            <section className="profile-main">
              <ProfileInfoCard profile={profile} />

              <form className="profile-card" onSubmit={handlePrivacySubmit}>
                <div className="profile-card-head"><h3>Cài đặt quyền riêng tư</h3><span className="tag cat">Khuyến nghị bật bảo vệ</span></div>
                <PrivacyLine name="showName" label="Hiển thị tên trên bài đăng" checked={privacy.showName} help="Nên bật để giao dịch dễ tin cậy." onChange={(checked) => setPrivacy((value) => ({ ...value, showName:checked }))} />
                <PrivacyLine name="showClass" label="Hiển thị lớp trên bài đăng" checked={privacy.showClass} help="Nên bật để học sinh cùng trường dễ nhận biết." onChange={(checked) => setPrivacy((value) => ({ ...value, showClass:checked }))} />
                <PrivacyLine name="showEmail" label="Hiển thị email công khai" checked={privacy.showEmail} help="Mặc định nên tắt. Email chỉ nên hiện khi thật cần." onChange={(checked) => setPrivacy((value) => ({ ...value, showEmail:checked }))} />
                <PrivacyLine name="showPhone" label="Hiển thị số điện thoại công khai" checked={privacy.showPhone} help="Mặc định nên tắt để bảo vệ thông tin cá nhân." onChange={(checked) => setPrivacy((value) => ({ ...value, showPhone:checked }))} />
                <div className="btn-row"><button className="btn primary" type="submit">Lưu quyền riêng tư</button></div>
              </form>

              <SavedPostsSection savedPosts={savedPosts} />

              <form className="profile-card" onSubmit={handleImageSave}>
                <div className="profile-card-head"><h3>Ảnh hồ sơ</h3><span className="tag cat">ĐA ĐỊNH DẠNG</span></div>
                <div className="profile-upload-grid">
                  <ProfileUploadBox inputId="avatarFile" title="Ảnh đại diện" help="Ảnh hiển thị trên thanh tài khoản" imageUrl={avatarDraft} status={avatarStatus} onFile={(file) => handleImagePick('avatar', file)} />
                  <ProfileUploadBox inputId="faceFile" title="Ảnh khuôn mặt" help="Ảnh nhận diện nội bộ, không công khai" imageUrl={faceDraft} status={faceStatus} onFile={(file) => handleImagePick('face', file)} />
                </div>
                <div className="btn-row"><button className="btn primary" type="submit">Lưu ảnh hồ sơ</button></div>
                <div className="form-note">Hỗ trợ HEIC/HEIF, TIFF, AVIF, GIF, BMP, SVG và nhiều định dạng phổ biến; ảnh sẽ được chuyển về JPEG tối ưu.</div>
              </form>

              <form className="profile-card" onSubmit={handlePasswordSubmit}>
                <div className="profile-card-head"><h3>Đổi mật khẩu</h3><span className="tag price">Bảo mật</span></div>
                <div className="field"><label className="req">Mật khẩu hiện tại</label><input name="currentPassword" type="password" required autoComplete="current-password" placeholder="Nhập mật khẩu hiện tại" /></div>
                <div className="grid-2">
                  <div className="field"><label className="req">Mật khẩu mới</label><input name="newPassword" type="password" required minLength={6} maxLength={80} autoComplete="new-password" placeholder="Tối thiểu 6 ký tự, gồm chữ và số" /></div>
                  <div className="field"><label className="req">Nhập lại mật khẩu mới</label><input name="confirmPassword" type="password" required minLength={6} maxLength={80} autoComplete="new-password" placeholder="Nhập lại mật khẩu mới" /></div>
                </div>
                <div className="form-note strong-note">Không dùng số điện thoại, email hoặc mật khẩu quá dễ đoán.</div>
                <div className="btn-row"><button className="btn green" type="submit">Đổi mật khẩu</button></div>
              </form>

              <NotificationsSection notifications={notifications} onReadAll={handleReadAll} />
              {message ? <div className={`state ${message.tone}`}>{message.text}</div> : null}
            </section>
          </div>
        </section>
      </main>
      <footer className="page-footer">Edu Share+ • Chia sẻ đồ dùng học tập an toàn trong trường</footer>
    </>
  );
}
