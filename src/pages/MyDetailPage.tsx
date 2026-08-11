import { useMemo, useState, type ReactNode } from 'react';
import { navigateLegacy } from '../app/legacyRouter';
import StudentHeader from '../components/student/StudentHeader';
import { buildOwnerEffectiveness, type OwnerContactLog, type OwnerDetailBundle } from '../features/my-posts/mockMyPostDetail';
import { getOwnerDetailLocal, prependOwnerTimelineLocal, updateOwnerDetailLocal } from '../features/my-posts/localOwnerDetailStore';
import { duplicateOwnerPost, getOwnerPost, updateOwnerPost } from '../features/my-posts/localOwnerStore';
import type { MyPost, MyPostStatus } from '../features/my-posts/types';

function getPostId(): string {
  return new URLSearchParams(window.location.search).get('id')?.trim() || '';
}

function formatMoney(value:number):string {
  return value > 0 ? `${value.toLocaleString('vi-VN')} đ` : 'Miễn phí / Thỏa thuận';
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

function badgeClass(status:MyPostStatus):string {
  if (status === 'Đang mở') return 'badge open';
  if (status === 'Chờ duyệt') return 'badge pending';
  if (status === 'Đã xong') return 'badge done';
  return 'badge reject';
}

function sourceLabel(post:MyPost):string {
  if (post.source === 'Archive') return 'Lịch sử';
  if (post.hidden) return 'Đang tạm ẩn';
  return 'Bài đang hoạt động';
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

export default function MyDetailPage() {
  const postId = getPostId();
  const [post, setPost] = useState<MyPost | undefined>(() => getOwnerPost(postId));
  const [detail, setDetail] = useState<OwnerDetailBundle>(() => post ? getOwnerDetailLocal(post) : { favorites:[], contacts:[], comments:[], timeline:[] });
  const [notice, setNotice] = useState('');
  const effectiveness = useMemo(() => post ? buildOwnerEffectiveness(post) : null, [post]);
  const lastContactAt = detail.contacts[0]?.date || 'Chưa có';

  if (!post) {
    return (
      <>
        <StudentHeader activePage="myDetail" />
        <main className="container ecom-page owner-detail-page">
          <section className="ecom-page-title"><div><span className="eyebrow">CHI TIẾT TIN ĐĂNG</span><h1>Chi tiết bài đăng của tôi</h1></div></section>
          <div className="state error">Không tìm thấy bài đăng local với mã <b>{postId || '(trống)'}</b>.</div>
          <div className="btn-row"><button className="btn gray" type="button" onClick={() => navigateLegacy('myPosts')}>← Bài của tôi</button></div>
        </main>
      </>
    );
  }

  const isArchive = post.source === 'Archive';
  const canEdit = !isArchive && ['Chờ duyệt','Từ chối','Đang mở'].includes(post.status);
  const canWithdraw = !isArchive;
  const canComplete = !isArchive && post.status === 'Đang mở';
  const canToggleHidden = !isArchive && post.status === 'Đang mở';
  const hasImage = Boolean(post.imageUrl);

  const toggleHidden = () => {
    const nextHidden = !post.hidden;
    if (!window.confirm(nextHidden ? 'Tạm ẩn bài khỏi trang chủ?' : 'Hiển thị lại bài trên trang chủ?')) return;
    const updated = updateOwnerPost(post.id, (current) => ({ ...current, hidden:nextHidden }));
    if (!updated) return;
    setPost(updated);
    setNotice(nextHidden ? 'Đã tạm ẩn bài trong phiên local.' : 'Đã hiển thị lại bài trong phiên local.');
    const nextDetail = prependOwnerTimelineLocal(updated, { type:'post', title:nextHidden ? 'Bài được tạm ẩn' : 'Bài được hiển thị lại', description:nextHidden ? 'Chủ bài tạm ẩn bài khỏi Marketplace.' : 'Chủ bài hiển thị lại bài trên Marketplace.', date:'Vừa xong • phiên local' });
    setDetail(nextDetail);
  };

  const completePost = () => {
    if (!window.confirm(`Xác nhận ${doneButtonText(post.tradeType).toLowerCase()} và chuyển bài sang lịch sử?`)) return;
    updateOwnerPost(post.id, (current) => ({ ...current, status:'Đã xong', source:'Archive', hidden:false, doneTs:Date.now() }));
    window.alert('Đã đánh dấu hoàn tất trong phiên local.');
    navigateLegacy('myPosts');
  };

  const withdrawPost = () => {
    if (!window.confirm('Thu hồi bài đăng này? Bài sẽ không còn hiển thị công khai.')) return;
    updateOwnerPost(post.id, (current) => ({ ...current, status:'Đã thu hồi', source:'Archive', hidden:false, doneTs:Date.now() }));
    window.alert('Đã thu hồi bài trong phiên local.');
    navigateLegacy('myPosts');
  };

  const duplicatePost = () => {
    if (!window.confirm('Nhân bản bài này thành bài mới ở trạng thái chờ duyệt?')) return;
    const duplicate = duplicateOwnerPost(post);
    window.alert('Đã nhân bản bài trong phiên local.');
    navigateLegacy('editPost', { id:duplicate.id });
  };

  const markHandled = (contact:OwnerContactLog) => {
    const note = window.prompt('Ghi chú ngắn sau khi đã liên hệ lại:', 'Đã liên hệ lại');
    if (note === null) return;
    const now = 'Vừa xong • phiên local';
    const nextDetail = updateOwnerDetailLocal(post, (current) => ({
      ...current,
      contacts:current.contacts.map((item) => item.id === contact.id ? { ...item, contacted:true, contactedAt:now, note:note.trim() || 'Đã liên hệ lại' } : item),
      timeline:[{ id:`TL-${Date.now()}`, type:'handled', title:'Đã phản hồi người quan tâm', description:`Đánh dấu đã liên hệ lại với ${contact.requesterName}.`, date:now }, ...current.timeline],
    }));
    setDetail(nextDetail);
    const updated = updateOwnerPost(post.id, (current) => ({ ...current, contactedCount:Math.min(current.contactViewCount, current.contactedCount + 1) }));
    if (updated) setPost(updated);
    setNotice('Đã đánh dấu đã liên hệ lại trong phiên local.');
  };

  return (
    <>
      <StudentHeader activePage="myDetail" />
      <main className="container ecom-page owner-detail-page">
        <section className="ecom-page-title">
          <div>
            <span className="eyebrow">CHI TIẾT TIN ĐĂNG</span>
            <h1>Chi tiết bài đăng của tôi</h1>
            <p>Học sinh - 12A1 • local-ui@edushare.test</p>
          </div>
          <div className="btn-row">
            <button className="btn gray" type="button" onClick={() => navigateLegacy('myPosts')}>← Bài của tôi</button>
            <button className="btn primary" type="button" onClick={() => navigateLegacy('add')}>+ Đăng bài</button>
          </div>
        </section>

        {notice ? <div className="state ok owner-local-notice" role="status">{notice}</div> : null}

        <section className="owner-detail-layout">
          <article className="card owner-detail-main">
            <div className="tags">
              <span className={badgeClass(post.status)}>{statusLabel(post.status)}</span>
              <span className="tag">{sourceLabel(post)}</span>
              <span className="tag price">{formatMoney(post.price)}</span>
            </div>
            <h2 className="owner-detail-title">{post.title}</h2>
            <div className="meta">{post.tradeType} • {post.category} • Ngày đăng: {post.date}</div>
            {post.doneTs ? <div className="meta">Bài đã được lưu trong lịch sử của phiên local.</div> : null}
            {post.rejectionReason ? <div className="reason-box"><b>Lý do từ chối: </b>{post.rejectionReason}</div> : null}
            <div className="desc owner-desc">{post.description || 'Chưa có mô tả.'}</div>
            <div className="owner-contact-self"><b>Thông tin liên hệ bạn đã cung cấp</b><span>{post.contactInfo || 'Chưa có'}</span></div>

            <div className="owner-action-panel">
              <h3>Thao tác với bài đăng</h3>
              <div className="actions owner-actions">
                <button className="btn gray" type="button" onClick={() => navigateLegacy('myPosts')}>Quay lại danh sách</button>
                {canEdit ? <button className="btn primary" type="button" onClick={() => navigateLegacy('editPost', { id:post.id })}>{post.status === 'Đang mở' ? 'Sửa & gửi duyệt lại' : 'Chỉnh sửa bài'}</button> : null}
                <button className="btn" type="button" onClick={duplicatePost}>Nhân bản bài</button>
                {canToggleHidden ? <button className="btn orange" type="button" onClick={toggleHidden}>{post.hidden ? 'Hiển thị lại' : 'Tạm ẩn bài'}</button> : null}
                {canComplete ? <button className="btn green" type="button" onClick={completePost}>{doneButtonText(post.tradeType)}</button> : null}
                {canWithdraw ? <button className="btn danger" type="button" onClick={withdrawPost}>Thu hồi bài</button> : null}
              </div>
            </div>
          </article>

          <aside className="owner-detail-side">
            {hasImage ? <img className="owner-detail-img" src={post.imageUrl} alt="Ảnh bài đăng" loading="lazy" decoding="async" /> : <div className="state">Bài đăng chưa có ảnh minh họa.</div>}
            {effectiveness ? (
              <div className={`effect-panel ${effectiveness.level}`}>
                <div className="effect-kicker">Hiệu quả bài đăng</div>
                <h3>{effectiveness.label}</h3>
                <p>{effectiveness.message}</p>
                {effectiveness.tips?.length ? <ul>{effectiveness.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul> : null}
              </div>
            ) : null}
          </aside>
        </section>

        <section className="stats-grid compact owner-detail-stats">
          <MetricCard label="Người lưu bài" value={post.favoriteCount} />
          <MetricCard label="Lượt xem liên hệ" value={post.contactViewCount} />
          <MetricCard label="Đã phản hồi" value={post.contactedCount} />
          <MetricCard label="Bình luận" value={post.commentCount} />
          <MetricCard label="Báo cáo" value={post.reportCount} />
          <MetricCard label="Liên hệ gần nhất" value={lastContactAt} />
        </section>

        <OwnerSection title="Người đã lưu bài" subtitle="Danh sách học sinh bấm “Lưu bài/Quan tâm”." count={`${detail.favorites.length} người`}>
          <div className="contact-log-list">
            {detail.favorites.length ? detail.favorites.map((item) => (
              <article className="contact-log-item" key={item.id}>
                <div><b>{item.name}</b><div className="meta">{[item.className, item.emailMasked, item.date].filter(Boolean).join(' • ')}</div></div>
                <span className="badge done">Đã lưu</span>
              </article>
            )) : <div className="state">Chưa có ai lưu bài này.</div>}
          </div>
        </OwnerSection>

        <OwnerSection title="Người đã xem liên hệ" subtitle="Theo dõi học sinh quan tâm và đánh dấu người bạn đã phản hồi." count={`${detail.contacts.length} lượt`}>
          <div className="contact-log-list">
            {detail.contacts.length ? detail.contacts.map((contact) => (
              <article className={`contact-log-item${contact.contacted ? ' handled' : ''}`} key={contact.id}>
                <div>
                  <b>{contact.requesterName}</b>
                  <div className="meta">{[contact.requesterClass, contact.requesterEmailMasked, contact.date].filter(Boolean).join(' • ')}</div>
                  {contact.contacted ? <div className="handled-note">Đã liên hệ lại{contact.contactedAt ? ` lúc ${contact.contactedAt}` : ''}{contact.note ? ` • ${contact.note}` : ''}</div> : null}
                </div>
                {contact.contacted ? <span className="badge done">Đã phản hồi</span> : <button className="btn small primary" type="button" onClick={() => markHandled(contact)}>Đánh dấu đã liên hệ</button>}
              </article>
            )) : <div className="state">Chưa có ai xem thông tin liên hệ của bài này.</div>}
          </div>
        </OwnerSection>

        <OwnerSection title="Bình luận trong bài" subtitle="Các trao đổi công khai của học sinh khác trong bài đăng.">
          <div className="comment-box">
            {detail.comments.length ? detail.comments.map((comment) => (
              <article className="comment-item owner-comment" key={comment.id}>
                <div className="title-cell">{comment.name}{comment.className ? ` - ${comment.className}` : ''}</div>
                <div className="meta">{[comment.emailMasked, comment.date].filter(Boolean).join(' • ')}</div>
                <div className="desc">{comment.content}</div>
              </article>
            )) : <div className="state">Chưa có bình luận nào.</div>}
          </div>
        </OwnerSection>

        <OwnerSection title="Timeline hoạt động" subtitle="Dòng thời gian giúp theo dõi vòng đời và tương tác của bài.">
          <div className="timeline">
            {detail.timeline.length ? detail.timeline.map((item) => (
              <div className={`timeline-item ${item.type}`} key={item.id}>
                <div className="timeline-dot" />
                <div className="timeline-body"><b>{item.title}</b><span>{item.description}</span><small>{item.date}</small></div>
              </div>
            )) : <div className="state">Chưa có lịch sử hoạt động.</div>}
          </div>
        </OwnerSection>
      </main>
      <footer className="page-footer">Edu Share+ • Chia sẻ đồ dùng học tập an toàn trong trường</footer>
    </>
  );
}

function MetricCard({ label, value }:{ label:string; value:string|number }) {
  return <div className="metric-card"><b>{String(value)}</b><span>{label}</span></div>;
}

function OwnerSection({ title, subtitle, count, children }:{ title:string; subtitle:string; count?:string; children:ReactNode }) {
  return (
    <section className="panel owner-section">
      <div className="section-head">
        <div><h2>{title}</h2><p>{subtitle}</p></div>
        {count ? <span className="pill">{count}</span> : null}
      </div>
      {children}
    </section>
  );
}
