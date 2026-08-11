import { navigateLegacy } from '../../../app/legacyRouter';
import type { NotificationLocal, SavedPostLocal, StudentProfileLocal } from '../types';

const IMAGE_ACCEPT = 'image/*,.heic,.heif,.tif,.tiff,.avif,.gif,.bmp,.svg';

function initials(profile:StudentProfileLocal):string {
  const value = (profile.name || profile.email || 'H').trim();
  return value.charAt(0).toUpperCase() || 'H';
}

export function ProfileSidebar({ profile }:{ profile:StudentProfileLocal }) {
  return (
    <aside className="profile-side">
      <div className={`profile-avatar${profile.avatarUrl ? ' has-photo' : ''}`} style={profile.avatarUrl ? { backgroundImage:`url("${profile.avatarUrl}")` } : undefined} aria-label="Ảnh đại diện">
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
  );
}

export function ProfileInfoCard({ profile }:{ profile:StudentProfileLocal }) {
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

export function PrivacyLine({ name, label, checked, help, onChange }:{ name:string; label:string; checked:boolean; help:string; onChange:(checked:boolean)=>void }) {
  return (
    <label className="privacy-switch">
      <input type="checkbox" name={name} value="TRUE" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span><b>{label}</b><small>{help}</small></span>
    </label>
  );
}

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
      ) : <div className="state">Bạn chưa lưu bài nào. Hãy bấm ♡ Lưu bài ở trang chủ hoặc trang chi tiết.</div>}
    </div>
  );
}

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

function MiniStat({ label, value }:{ label:string; value:number }) {
  return <div className="mini-stat"><b>{value}</b><span>{label}</span></div>;
}

function InfoItem({ label, value }:{ label:string; value:string }) {
  return <div className="profile-info-item"><span>{label}</span><b>{value || 'Chưa cập nhật'}</b></div>;
}
