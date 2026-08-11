import { FormEvent, useMemo, useState } from 'react';
import { navigateLegacy } from '../app/legacyRouter';
import StudentHeader from '../components/student/StudentHeader';
import {
  getProfileBundleLocal,
  markAllNotificationsReadLocal,
  recordPasswordChangedLocal,
  updatePrivacyLocal,
  updateProfileImagesLocal,
} from '../features/profile/localProfileStore';
import type { ProfilePrivacy, StudentProfileLocal } from '../features/profile/types';

const IMAGE_ACCEPT = 'image/*,.heic,.heif,.tif,.tiff,.avif,.gif,.bmp,.svg';

type MessageState = { tone:'ok' | 'error'; text:string } | null;

function initials(profile:StudentProfileLocal):string {
  const value = (profile.name || profile.email || 'H').trim();
  return value.charAt(0).toUpperCase() || 'H';
}

function passwordIsReasonable(value:string):boolean {
  return value.length >= 6 && /[A-Za-zÀ-ỹ]/.test(value) && /\d/.test(value);
}

export default function ProfilePage() {
  const initial = useMemo(() => getProfileBundleLocal(), []);
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
    const next = updatePrivacyLocal(privacy);
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
    const next = updateProfileImagesLocal({ avatarUrl:avatarDraft, faceUrl:faceDraft });
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

    const next = recordPasswordChangedLocal();
    setProfile(next);
    setNotifications(getProfileBundleLocal().notifications);
    event.currentTarget.reset();
    setMessage({ tone:'ok', text:'Đã hoàn tất mô phỏng đổi mật khẩu local. Mật khẩu thật chưa bị thay đổi vì Auth sẽ được triển khai ở Phase 4.' });
  };

  const handleReadAll = () => {
    setNotifications(markAllNotificationsReadLocal());
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
            <aside className="profile-side">
              <div
                className={`profile-avatar${profile.avatarUrl ? ' has-photo' : ''}`}
                style={profile.avatarUrl ? { backgroundImage:`url("${profile.avatarUrl}")` } : undefined}
                aria-label="Ảnh đại diện"
              >
                {profile.avatarUrl ? null : <span>{initials(profile)}</span>}
              </div>
              <h2>{profile.name || 'Học sinh'}</h2>
              <div className="profile-sub">{profile.className || 'Chưa có lớp'} • {profile.email}</div>
              <div className="profile-note reputation-box">
                <b>Điểm uy tín: {profile.reputation.score}/10</b>
                <span>{profile.reputation.label}</span>
                <small>Hoàn tất: {profile.reputation.detail.done} • Báo cáo: {profile.reputation.detail.reports} • Lượt lưu: {profile.reputation.detail.saves}</small>
              </div>
              <div className="mini-stat-grid">
                <MiniStat label="Bài đã đăng" value={profile.activity.posts} />
                <MiniStat label="Đang mở" value={profile.activity.open} />
                <MiniStat label="Đã lưu" value={profile.activity.savedPosts} />
                <MiniStat label="Bình luận" value={profile.activity.comments} />
                <MiniStat label="Xem liên hệ" value={profile.activity.contactViews} />
                <MiniStat label="Hoàn tất" value={profile.activity.done} />
              </div>
            </aside>

            <section className="profile-main">
              <InfoCard profile={profile} />

              <form className="profile-card" onSubmit={handlePrivacySubmit}>
                <div className="profile-card-head">
                  <h3>Cài đặt quyền riêng tư</h3>
                  <span className="tag cat">Khuyến nghị bật bảo vệ</span>
                </div>
                <PrivacyLine name="showName" label="Hiển thị tên trên bài đăng" checked={privacy.showName} help="Nên bật để giao dịch dễ tin cậy." onChange={(checked) => setPrivacy((value) => ({ ...value, showName:checked }))} />
                <PrivacyLine name="showClass" label="Hiển thị lớp trên bài đăng" checked={privacy.showClass} help="Nên bật để học sinh cùng trường dễ nhận biết." onChange={(checked) => setPrivacy((value) => ({ ...value, showClass:checked }))} />
                <PrivacyLine name="showEmail" label="Hiển thị email công khai" checked={privacy.showEmail} help="Mặc định nên tắt. Email chỉ nên hiện khi thật cần." onChange={(checked) => setPrivacy((value) => ({ ...value, showEmail:checked }))} />
                <PrivacyLine name="showPhone" label="Hiển thị số điện thoại công khai" checked={privacy.showPhone} help="Mặc định nên tắt để bảo vệ thông tin cá nhân." onChange={(checked) => setPrivacy((value) => ({ ...value, showPhone:checked }))} />
                <div className="btn-row"><button className="btn primary" type="submit">Lưu quyền riêng tư</button></div>
              </form>

              <div className="profile-card">
                <div className="profile-card-head"><h3>Bài tôi đã lưu</h3><span className="tag price">{savedPosts.length} bài</span></div>
                {savedPosts.length ? (
                  <div className="saved-list">
                    {savedPosts.slice(0,8).map((post) => (
                      <div className="saved-item" key={post.id}>
                        <div className="profile-list-copy"><b>{post.title}</b><span>{post.tradeType} • {post.category} • Lưu lúc: {post.savedAt}</span></div>
                        <button className="btn small primary" type="button" onClick={() => navigateLegacy('detail', { id:post.id })}>Xem</button>
                      </div>
                    ))}
                  </div>
                ) : <div className="state">Bạn chưa lưu bài nào. Hãy bấm ♡ Lưu bài ở trang chủ hoặc trang chi tiết.</div>}
              </div>

              <form className="profile-card" onSubmit={handleImageSave}>
                <div className="profile-card-head"><h3>Ảnh hồ sơ</h3><span className="tag cat">ĐA ĐỊNH DẠNG</span></div>
                <div className="profile-upload-grid">
                  <UploadBox inputId="avatarFile" title="Ảnh đại diện" help="Ảnh hiển thị trên thanh tài khoản" imageUrl={avatarDraft} status={avatarStatus} onFile={(file) => handleImagePick('avatar', file)} />
                  <UploadBox inputId="faceFile" title="Ảnh khuôn mặt" help="Ảnh nhận diện nội bộ, không công khai" imageUrl={faceDraft} status={faceStatus} onFile={(file) => handleImagePick('face', file)} />
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

              <div className="profile-card">
                <div className="profile-card-head"><h3>Thông báo gần đây</h3><button className="btn small gray" type="button" onClick={handleReadAll}>Đánh dấu đã đọc</button></div>
                {notifications.length ? (
                  <div className="saved-list">
                    {notifications.slice(0,6).map((notification) => (
                      <div className={`saved-item${notification.read ? '' : ' unread-mini'}`} key={notification.id}>
                        <div className="profile-list-copy"><b>{notification.title}</b><span>{notification.message}</span><small>{notification.date}</small></div>
                      </div>
                    ))}
                  </div>
                ) : <div className="state">Chưa có thông báo.</div>}
              </div>

              {message ? <div className={`state ${message.tone}`}>{message.text}</div> : null}
            </section>
          </div>
        </section>
      </main>
      <footer className="page-footer">Edu Share+ • Chia sẻ đồ dùng học tập an toàn trong trường</footer>
    </>
  );
}

function MiniStat({ label, value }:{ label:string; value:number }) {
  return <div className="mini-stat"><b>{value}</b><span>{label}</span></div>;
}

function InfoCard({ profile }:{ profile:StudentProfileLocal }) {
  return (
    <div className="profile-card">
      <div className="profile-card-head"><h3>Thông tin tài khoản</h3><span className="tag">{profile.passwordStatus || 'Đã thiết lập'}</span></div>
      <div className="profile-info-grid">
        <InfoItem label="Họ và tên" value={profile.name} />
        <InfoItem label="Lớp" value={profile.className} />
        <InfoItem label="Email" value={profile.email} />
        <InfoItem label="Số điện thoại" value={profile.phoneMasked || profile.phone} />
        <InfoItem label="Mật khẩu" value="••••••••" />
        <InfoItem label="Lần đăng nhập gần nhất" value={profile.lastLogin || 'Chưa có dữ liệu'} />
      </div>
      <div className="form-note">Thông tin liên hệ được che mặc định ở trang công khai; người khác phải bấm Xem liên hệ thì hệ thống mới ghi nhận lượt xem.</div>
    </div>
  );
}

function InfoItem({ label, value }:{ label:string; value:string }) {
  return <div className="profile-info-item"><span>{label}</span><b>{value || 'Chưa cập nhật'}</b></div>;
}

function PrivacyLine({ name, label, checked, help, onChange }:{ name:string; label:string; checked:boolean; help:string; onChange:(checked:boolean)=>void }) {
  return (
    <label className="privacy-switch">
      <input type="checkbox" name={name} value="TRUE" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span><b>{label}</b><small>{help}</small></span>
    </label>
  );
}

function UploadBox({ inputId, title, help, imageUrl, status, onFile }:{ inputId:string; title:string; help:string; imageUrl:string; status:string; onFile:(file?:File)=>void }) {
  return (
    <div className="profile-upload-box">
      <div className={`profile-preview${imageUrl ? ' has-photo' : ''}`} style={imageUrl ? { backgroundImage:`url("${imageUrl}")` } : undefined}>
        {imageUrl ? null : <span>Chưa có ảnh</span>}
      </div>
      <div className="field">
        <label htmlFor={inputId}>{title}</label>
        <input id={inputId} type="file" accept={IMAGE_ACCEPT} onChange={(event) => onFile(event.target.files?.[0])} />
        <small>{help}</small>
        <div className="form-note">{status}</div>
      </div>
    </div>
  );
}
