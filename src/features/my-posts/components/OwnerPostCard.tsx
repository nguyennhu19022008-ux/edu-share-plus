import { navigateLegacy } from '../../../app/legacyRouter';
import type { MyPost } from '../types';
import { doneButtonText, formatMyPostMoney, getPostEffectiveness, myPostStatusBadgeClass, myPostStatusCardClass, myPostStatusLabel } from '../viewUtils';

export default function OwnerPostCard({ post, onToggleHidden, onComplete, onWithdraw, onDuplicate }:{
  post:MyPost;
  onToggleHidden:()=>void;
  onComplete:()=>void;
  onWithdraw:()=>void;
  onDuplicate:()=>void;
}) {
  const effectiveness = getPostEffectiveness(post);
  const unhandledContacts = Math.max(0, post.contactViewCount - post.contactedCount);
  const insightTitle = unhandledContacts > 0 ? 'Cần phản hồi' : effectiveness.label;
  const insightMessage = unhandledContacts > 0
    ? `Có ${unhandledContacts} lượt xem liên hệ chưa được đánh dấu đã phản hồi.`
    : effectiveness.message;
  const isArchive = post.source === 'Archive';
  const canEdit = !isArchive && ['Chờ duyệt','Từ chối','Đang mở'].includes(post.status);
  const canWithdraw = !isArchive;
  const canComplete = !isArchive && post.status === 'Đang mở';
  const canToggleHidden = !isArchive && post.status === 'Đang mở';

  return (
    <article className={`owner-post-card owner-status-${myPostStatusCardClass(post.status)}`}>
      <div className="owner-card-heading">
        <span className={`${myPostStatusBadgeClass(post.status)} owner-status-badge`}>{myPostStatusLabel(post.status)}</span>
        <strong className={`owner-card-price${post.price > 0 ? '' : ' free'}`}>{formatMyPostMoney(post.price)}</strong>
      </div>
      <div className="owner-card-context">
        <span className="owner-posted-at">Đăng: {post.date}</span>
        <span className="owner-post-taxonomy">{[post.tradeType, post.category, post.className].join(' • ')}</span>
      </div>
      <h2 className="owner-card-title" title={post.title}>{post.title}</h2>
      {post.rejectionReason ? <div className="reason-box compact owner-rejection-reason"><b>Lý do từ chối: </b>{post.rejectionReason}</div> : null}
      <div className="owner-metrics owner-metrics-inline">
        <Metric value={post.favoriteCount} label="Lượt lưu" />
        <Metric value={post.contactViewCount} label="Lượt xem LH" />
        <Metric value={post.commentCount} label="Bình luận" />
        <Metric value={post.reportCount} label="Báo cáo" />
      </div>
      <div className={`owner-insight ${unhandledContacts > 0 ? 'needs-action' : effectiveness.level}`}>
        <b>{insightTitle}</b><span>{insightMessage}</span>
      </div>
      <div className="owner-action-grid">
        <OwnerAction label="Chi tiết" onClick={() => navigateLegacy('myDetail', { id:post.id })} />
        {canEdit ? <OwnerAction label={post.status === 'Đang mở' ? 'Sửa & duyệt lại' : 'Chỉnh sửa'} onClick={() => navigateLegacy('editPost', { id:post.id })} /> : null}
        <OwnerAction label="Nhân bản" onClick={onDuplicate} />
        {canToggleHidden ? <OwnerAction label={post.hidden ? 'Hiển thị lại' : 'Tạm ẩn'} onClick={onToggleHidden} /> : null}
        {canComplete ? <OwnerAction label={doneButtonText(post.tradeType)} onClick={onComplete} /> : null}
        {canWithdraw ? <OwnerAction label="Thu hồi" onClick={onWithdraw} /> : null}
      </div>
    </article>
  );
}

function Metric({ value, label }:{ value:number; label:string }) {
  return <div className="owner-metric-inline"><b>{value}</b><span>{label}</span></div>;
}

function OwnerAction({ label, onClick }:{ label:string; onClick:()=>void }) {
  return <button className="owner-action-button" type="button" onClick={onClick}>{label}</button>;
}
