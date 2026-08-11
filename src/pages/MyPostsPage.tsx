import { useEffect, useMemo, useState } from 'react';
import { navigateLegacy } from '../app/legacyRouter';
import StudentHeader from '../components/student/StudentHeader';
import { duplicateOwnerPost, getOwnerPosts, updateOwnerPost as updateOwnerPostStore } from '../features/my-posts/localOwnerStore';
import { prependOwnerTimelineLocal } from '../features/my-posts/localOwnerDetailStore';
import type { MyPost, MyPostSort, MyPostStatus, PostEffectiveness } from '../features/my-posts/types';

const STATUS_TABS: Array<{ value:'' | MyPostStatus; label:string }> = [
  { value:'', label:'Tất cả' },
  { value:'Đang mở', label:'Đang giao dịch' },
  { value:'Chờ duyệt', label:'Chờ duyệt' },
  { value:'Từ chối', label:'Từ chối' },
  { value:'Đã xong', label:'Hoàn tất' },
  { value:'Đã thu hồi', label:'Thu hồi' },
];

function normalize(value:string):string {
  return value.trim().toLocaleLowerCase('vi');
}

function formatMoney(value:number):string {
  return value > 0 ? `${value.toLocaleString('vi-VN')} đ` : 'Miễn phí / Cho tặng';
}

function statusLabel(status:MyPostStatus):string {
  const labels:Record<MyPostStatus,string> = {
    'Đang mở':'Đang giao dịch',
    'Chờ duyệt':'Chờ giáo viên duyệt',
    'Từ chối':'Từ chối',
    'Đã xong':'Đã hoàn tất',
    'Đã thu hồi':'Đã thu hồi',
  };
  return labels[status];
}

function statusBadgeClass(status:MyPostStatus):string {
  if (status === 'Đang mở') return 'badge open';
  if (status === 'Chờ duyệt') return 'badge pending';
  if (status === 'Đã xong') return 'badge done';
  return 'badge reject';
}

function statusCardClass(status:MyPostStatus):string {
  const map:Record<MyPostStatus,string> = {
    'Đang mở':'open',
    'Chờ duyệt':'pending',
    'Từ chối':'rejected',
    'Đã xong':'done',
    'Đã thu hồi':'withdrawn',
  };
  return map[status];
}

function doneButtonText(type:MyPost['tradeType']):string {
  const map:Record<MyPost['tradeType'],string> = {
    'Cho mượn':'Đã cho mượn',
    'Cho tặng':'Đã tặng',
    'Trao đổi':'Đã trao đổi',
    'Bán giá rẻ':'Đã bán',
  };
  return map[type];
}

function getEffectiveness(post:MyPost):PostEffectiveness {
  const saves = Number(post.favoriteCount || 0);
  const contacts = Number(post.contactViewCount || 0);
  const comments = Number(post.commentCount || 0);

  if (post.status === 'Chờ duyệt') return { level:'pending', label:'Đang chờ duyệt', message:'Bài chưa công khai nên chưa có dữ liệu tương tác.' };
  if (post.status === 'Từ chối') return { level:'warning', label:'Cần chỉnh sửa', message:'Bài cần được sửa theo góp ý của giáo viên rồi gửi duyệt lại.' };
  if (post.status === 'Đã xong') return { level:'done', label:'Đã hoàn tất', message:'Bài đã hoàn tất giao dịch và được lưu trong lịch sử.' };
  if (post.status === 'Đã thu hồi') return { level:'muted', label:'Đã thu hồi', message:'Bài đã được chủ bài thu hồi và không còn hiển thị công khai.' };
  if (post.hidden) return { level:'muted', label:'Đang tạm ẩn', message:'Bài đang tạm ẩn nên người khác không thể xem trên trang chủ.' };
  if (saves >= 5 || contacts >= 5 || comments >= 3) return { level:'good', label:'Tương tác tốt', message:'Bài có nhiều lượt lưu/xem liên hệ/bình luận.' };
  if (saves > 0 || contacts > 0 || comments > 0) return { level:'normal', label:'Có tương tác', message:'Bài đã bắt đầu có người quan tâm.' };
  return { level:'low', label:'Chưa có tương tác', message:'Bài chưa có lượt lưu, xem liên hệ hoặc bình luận.' };
}

export default function MyPostsPage() {
  const [items, setItems] = useState<MyPost[]>(() => getOwnerPosts());
  const [status, setStatus] = useState<'' | MyPostStatus>('');
  const [keyword, setKeyword] = useState('');
  const [sort, setSort] = useState<MyPostSort>('new');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    document.body.className = 'ecommerce-body';
    return () => { document.body.className = ''; };
  }, []);

  const dashboard = useMemo(() => {
    const result = { total:items.length, open:0, done:0, needAction:0 };
    items.forEach((post) => {
      if (post.status === 'Đang mở') result.open += 1;
      if (post.status === 'Đã xong') result.done += 1;
      if (post.status === 'Từ chối' || post.contactViewCount > post.contactedCount) result.needAction += 1;
    });
    return result;
  }, [items]);

  const filteredItems = useMemo(() => {
    const kw = normalize(keyword);
    const list = items.filter((post) => {
      if (status && post.status !== status) return false;
      if (!kw) return true;
      const haystack = normalize([
        post.title,
        post.description,
        post.tradeType,
        post.category,
        statusLabel(post.status),
        post.rejectionReason || '',
      ].join(' '));
      return haystack.includes(kw);
    });

    return [...list].sort((a,b) => {
      if (sort === 'contacts') return b.contactViewCount - a.contactViewCount || b.dateTs - a.dateTs;
      if (sort === 'comments') return b.commentCount - a.commentCount || b.dateTs - a.dateTs;
      if (sort === 'needAction') {
        const score = (post:MyPost) => (post.status === 'Từ chối' ? 1000 : 0) + Math.max(0, post.contactViewCount - post.contactedCount);
        return score(b) - score(a) || b.dateTs - a.dateTs;
      }
      return (b.doneTs || b.dateTs) - (a.doneTs || a.dateTs);
    });
  }, [items, keyword, sort, status]);

  const countStatus = (target:'' | MyPostStatus) => items.filter((post) => !target || post.status === target).length;

  const clearFilters = () => {
    setStatus('');
    setKeyword('');
    setSort('new');
  };

  const updatePost = (id:string, updater:(post:MyPost)=>MyPost, message:string):MyPost | undefined => {
    const updated = updateOwnerPostStore(id, updater);
    if (updated) setItems(getOwnerPosts());
    setNotice(message);
    return updated;
  };

  const toggleHidden = (post:MyPost) => {
    const nextHidden = !post.hidden;
    const ok = window.confirm(nextHidden ? 'Tạm ẩn bài khỏi trang chủ?' : 'Hiển thị lại bài trên trang chủ?');
    if (!ok) return;
    const updated = updatePost(post.id, (current) => ({ ...current, hidden:nextHidden }), nextHidden ? 'Đã tạm ẩn bài trong phiên local.' : 'Đã hiển thị lại bài trong phiên local.');
    if (updated) prependOwnerTimelineLocal(updated, { type:'post', title:nextHidden ? 'Bài được tạm ẩn' : 'Bài được hiển thị lại', description:nextHidden ? 'Chủ bài tạm ẩn bài khỏi Marketplace.' : 'Chủ bài hiển thị lại bài trên Marketplace.', date:'Vừa xong • phiên local' });
  };

  const completePost = (post:MyPost) => {
    if (!window.confirm(`Xác nhận ${doneButtonText(post.tradeType).toLowerCase()} và chuyển bài sang lịch sử?`)) return;
    const updated = updatePost(post.id, (current) => ({ ...current, status:'Đã xong', source:'Archive', hidden:false, doneTs:Date.now() }), 'Đã đánh dấu hoàn tất trong phiên local.');
    if (updated) prependOwnerTimelineLocal(updated, { type:'post', title:'Bài đã hoàn tất', description:`Chủ bài xác nhận ${doneButtonText(post.tradeType).toLowerCase()} và chuyển bài vào lịch sử.`, date:'Vừa xong • phiên local' });
  };

  const withdrawPost = (post:MyPost) => {
    if (!window.confirm('Thu hồi bài đăng này? Bài sẽ không còn hiển thị công khai và được lưu vào lịch sử.')) return;
    const updated = updatePost(post.id, (current) => ({ ...current, status:'Đã thu hồi', source:'Archive', hidden:false, doneTs:Date.now() }), 'Đã thu hồi bài trong phiên local.');
    if (updated) prependOwnerTimelineLocal(updated, { type:'post', title:'Bài đã được thu hồi', description:'Chủ bài thu hồi bài khỏi Marketplace và chuyển vào lịch sử.', date:'Vừa xong • phiên local' });
  };

  const duplicatePost = (post:MyPost) => {
    if (!window.confirm('Nhân bản bài này thành bài mới ở trạng thái chờ duyệt?')) return;
    const duplicate = duplicateOwnerPost(post);
    setItems(getOwnerPosts());
    setNotice('Đã tạo bản sao local ở trạng thái chờ duyệt.');
    window.setTimeout(() => navigateLegacy('editPost', { id:duplicate.id }), 450);
  };

  return (
    <>
      <StudentHeader activePage="myPosts" />
      <main className="container ecom-page owner-page">
        <section className="ecom-page-title">
          <div>
            <span className="eyebrow">QUẢN LÝ TIN ĐĂNG</span>
            <h1>Bài đăng của tôi</h1>
            <p>Học sinh - 12A1 • local-ui@edushare.test</p>
          </div>
          <button className="btn primary" type="button" onClick={() => navigateLegacy('add')}>+ Đăng bài mới</button>
        </section>

        <section className="owner-dashboard-compact" aria-label="Tổng quan bài đăng">
          <SummaryCard label="Tổng bài" value={dashboard.total} mark="▦" tone="blue" />
          <SummaryCard label="Đang giao dịch" value={dashboard.open} mark="↻" tone="green" />
          <SummaryCard label="Hoàn tất" value={dashboard.done} mark="✓" tone="teal" />
          <SummaryCard label="Cần xử lý" value={dashboard.needAction} mark="!" tone="orange" />
        </section>

        <section className="owner-controls-card" aria-label="Bộ lọc bài đăng của tôi">
          <div className="owner-controls-heading">
            <div>
              <span className="owner-controls-eyebrow">QUẢN LÝ BÀI ĐĂNG</span>
              <h2>Lọc và xử lý bài nhanh</h2>
            </div>
            <span className="owner-result-summary">{filteredItems.length} bài phù hợp</span>
          </div>

          <div className="owner-status-tabs">
            {STATUS_TABS.map((tab) => {
              const count = countStatus(tab.value);
              return (
                <button
                  key={tab.value || 'all'}
                  className={`tab-btn${status === tab.value ? ' active' : ''}`}
                  type="button"
                  onClick={() => setStatus(tab.value)}
                >
                  {tab.label}{count ? ` (${count})` : ''}
                </button>
              );
            })}
          </div>

          <div className="owner-filter-row">
            <label className="owner-filter-field owner-filter-search">
              <span>Tìm kiếm</span>
              <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm theo tiêu đề, danh mục, mô tả..." />
            </label>
            <label className="owner-filter-field owner-filter-sort">
              <span>Sắp xếp</span>
              <select value={sort} onChange={(event) => setSort(event.target.value as MyPostSort)}>
                <option value="new">Mới nhất</option>
                <option value="contacts">Nhiều người quan tâm</option>
                <option value="comments">Nhiều bình luận</option>
                <option value="needAction">Cần xử lý trước</option>
              </select>
            </label>
            <button className="owner-clear-filter" type="button" onClick={clearFilters}>Xóa lọc</button>
          </div>
        </section>

        {notice ? <div className="state ok owner-local-notice" role="status">{notice}</div> : null}

        <section className="owner-post-grid">
          {filteredItems.length ? filteredItems.map((post) => (
            <OwnerPostCard
              key={post.id}
              post={post}
              onToggleHidden={() => toggleHidden(post)}
              onComplete={() => completePost(post)}
              onWithdraw={() => withdrawPost(post)}
              onDuplicate={() => duplicatePost(post)}
            />
          )) : <div className="state">Bạn chưa có bài đăng phù hợp.</div>}
        </section>
      </main>
      <footer className="page-footer">Edu Share+ • Chia sẻ đồ dùng học tập an toàn trong trường</footer>
    </>
  );
}

function SummaryCard({ label, value, mark, tone }:{ label:string; value:number; mark:string; tone:'blue'|'green'|'teal'|'orange' }) {
  return (
    <article className={`owner-summary-card ${tone}`}>
      <div className="owner-summary-copy"><span>{label}</span><b>{value}</b></div>
      <span className="owner-summary-mark" aria-hidden="true">{mark}</span>
    </article>
  );
}

function OwnerPostCard({ post, onToggleHidden, onComplete, onWithdraw, onDuplicate }:{
  post:MyPost;
  onToggleHidden:()=>void;
  onComplete:()=>void;
  onWithdraw:()=>void;
  onDuplicate:()=>void;
}) {
  const effectiveness = getEffectiveness(post);
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
    <article className={`owner-post-card owner-status-${statusCardClass(post.status)}`}>
      <div className="owner-card-heading">
        <span className={`${statusBadgeClass(post.status)} owner-status-badge`}>{statusLabel(post.status)}</span>
        <strong className={`owner-card-price${post.price > 0 ? '' : ' free'}`}>{formatMoney(post.price)}</strong>
      </div>

      <div className="owner-card-context">
        <span className="owner-posted-at">Đăng: {post.date}</span>
        <span className="owner-post-taxonomy">{[post.tradeType, post.category, post.className].join(' • ')}</span>
      </div>

      <h2 className="owner-card-title" title={post.title}>{post.title}</h2>

      {post.rejectionReason ? (
        <div className="reason-box compact owner-rejection-reason"><b>Lý do từ chối: </b>{post.rejectionReason}</div>
      ) : null}

      <div className="owner-metrics owner-metrics-inline">
        <Metric value={post.favoriteCount} label="Lượt lưu" />
        <Metric value={post.contactViewCount} label="Lượt xem LH" />
        <Metric value={post.commentCount} label="Bình luận" />
        <Metric value={post.reportCount} label="Báo cáo" />
      </div>

      <div className={`owner-insight ${unhandledContacts > 0 ? 'needs-action' : effectiveness.level}`}>
        <b>{insightTitle}</b>
        <span>{insightMessage}</span>
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
