import { navigateLegacy } from '../../../app/legacyRouter';
import type {
  NotificationLocal,
  SavedPostLocal,
  StudentProfileView,
} from '../types';

const IMAGE_ACCEPT = 'image/*,.heic,.heif,.tif,.tiff,.avif,.gif,.bmp,.svg';

function initials(profile:StudentProfileView):string {
  const value = (profile.name || profile.email || 'H').trim();
  return value.charAt(0).toUpperCase() || 'H';
}

export function ProfileSidebar({ profile }:{ profile:StudentProfileView }) {
  return (
    <aside className="profile-side">
      <div className={`profile-avatar${profile.avatarUrl ? ' has-photo' : ''}`} style={profile.avatarUrl ? { backgroundImage:`url("${profile.avatarUrl}")` } : undefined} aria-label="Ảnh đại diện">
        {profile.avatarUrl ? null : <span>{initials(profile)}</span>}
      </div>
      <h2>{profile.name || 'Học sinh'}</h2>
      <div className="profile-sub">{profile.className || 'Chưa cập nhật'} • {profile.email}</div>
      <div className="profile-note reputation-box">
        <b>Điểm uy tín lưu trữ: {profile.reputation.score}/10</b>
        <span>{profile.reputation.label}</span>
        <small>Phase 5D chỉ hiển thị cache đã lưu. Thuật toán và diễn giải chi tiết thuộc Phase 6.</small>
      </div>
    </aside>
  );
}

export function ProfileInfoCard({ profile }:{ profile:StudentProfileView }) {
  return (
    <div className="profile-card">
      <div className="profile-card-head"><h3>Thông tin tài khoản</h3><span className="tag">{profile.passwordStatus}</span></div>
      <div className="profile-info-grid">
        <InfoItem label="Họ và tên" value={profile.name} />
        <InfoItem label="Lớp" value={profile.className} />
        <InfoItem label="Email" value={profile.email} />
        <InfoItem label="Số điện thoại" value={profile.phoneMasked || profile.phone} />
        <InfoItem label="Mật khẩu" value="••••••••" />
        <InfoItem label="Lần đăng nhập gần nhất" value={profile.lastLogin} />
      </div>
      <div className="form-note">Thông tin liên hệ vẫn là dữ liệu riêng tư. Các cờ hiển thị chỉ là chính sách quyền riêng tư; việc Xem liên hệ thật được triển khai ở Phase 5G.</div>
    </div>
  );
}

export function PrivacyLine({ name, label, checked, help, onChange }:{ name:string; label:string; checked:boolean; help:string; onChange:(checked:boolean)=>void }) {
  return (
    <label className="privacy-switch">
      <input type="checkbox" name={name} value="TRUE" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span><b>{label}</b><small>{help}</small></span>
    </label>
  );
}

/** Legacy component retained for deferred/local screens only. ProfilePage does not use it in Phase 5D. */
export function ProfileUploadBox({ inputId, title, help, imageUrl, status, onFile }:{ inputId:string; title:string; help:string; imageUrl:string; status:string; onFile:(file?:File)=>void }) {
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

/** Legacy component retained for callers scheduled to move to the Phase 5G source. */
export function SavedPostsSection({ savedPosts }:{ savedPosts:SavedPostLocal[] }) {
  return (
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
      ) : <div className="state">Bạn chưa lưu bài nào.</div>}
    </div>
  );
}

/** Legacy component retained for callers scheduled to move to the Phase 5H source. */
export function NotificationsSection({ notifications, onReadAll }:{ notifications:NotificationLocal[]; onReadAll:()=>void }) {
  return (
    <div className="profile-card">
      <div className="profile-card-head"><h3>Thông báo gần đây</h3><button className="btn small gray" type="button" onClick={onReadAll}>Đánh dấu đã đọc</button></div>
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
  );
}

function InfoItem({ label, value }:{ label:string; value:string }) {
  return <div className="profile-info-item"><span>{label}</span><b>{value || 'Chưa cập nhật'}</b></div>;
}
