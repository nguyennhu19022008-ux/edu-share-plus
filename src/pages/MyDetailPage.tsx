import { useEffect, useState } from 'react';
import { navigateLegacy } from '../app/legacyRouter';
import StudentHeader from '../components/student/StudentHeader';
import type { OwnerPostDetail, OwnerPostView } from '../features/my-posts/ownerPostModel';
import {
  changeMyPostLifecycle,
  createMyPost,
  getMyPost,
} from '../features/my-posts/ownerPostService';
import { listPostMedia } from '../features/storage/mediaService';
import type { SignedMedia } from '../features/storage/mediaModel';

function getPostId():string {
  return new URLSearchParams(window.location.search).get('id')?.trim() || '';
}

function moderationBadge(status:OwnerPostView['moderationStatus']):string {
  if (status === 'approved') return 'badge open';
  if (status === 'pending') return 'badge pending';
  return 'badge reject';
}

function lifecycleBadge(status:OwnerPostView['lifecycleStatus']):string {
  return status === 'active' ? 'badge open' : 'badge done';
}

function contactLabel(method:OwnerPostView['preferredContactMethod']):string {
  return method === 'email' ? 'Email trong hồ sơ' : 'Số điện thoại trong hồ sơ';
}

function formatHistoryTime(value:string):string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone:'Asia/Ho_Chi_Minh',
    dateStyle:'short',
    timeStyle:'short',
  }).format(date);
}

export default function MyDetailPage() {
  const postId = getPostId();
  const [detail, setDetail] = useState<OwnerPostDetail | null>(null);
  const [media, setMedia] = useState<SignedMedia[]>([]);
  const [mediaError, setMediaError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reloadVersion, setReloadVersion] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setMedia([]);
    setMediaError('');

    if (!postId) {
      setDetail(null);
      setLoading(false);
      return () => { cancelled = true; };
    }

    void getMyPost(postId)
      .then((nextDetail) => {
        if (!cancelled) setDetail(nextDetail);
      })
      .catch((reason:unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Không thể tải bài đăng.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    void listPostMedia(postId)
      .then((items) => {
        if (!cancelled) setMedia(items);
      })
      .catch((reason:unknown) => {
        if (!cancelled) setMediaError(reason instanceof Error ? reason.message : 'Không thể tải ảnh bài đăng.');
      });

    return () => {
      cancelled = true;
    };
  }, [postId, reloadVersion]);

  const reload = (message?:string) => {
    if (message) setNotice(message);
    setReloadVersion((value) => value + 1);
  };

  const runLifecycle = async (action:'complete' | 'withdraw') => {
    if (!detail || busy) return;
    const question = action === 'complete'
      ? 'Xác nhận bài đã hoàn tất giao dịch/chia sẻ?'
      : 'Thu hồi bài đăng này khỏi trạng thái hoạt động?';
    if (!window.confirm(question)) return;

    setBusy(true);
    setError('');
    try {
      await changeMyPostLifecycle(detail.post.id, action);
      reload(action === 'complete' ? 'Đã đánh dấu bài hoàn tất.' : 'Đã thu hồi bài đăng.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể cập nhật vòng đời bài đăng.');
    } finally {
      setBusy(false);
    }
  };

  const duplicatePost = async () => {
    if (!detail || busy) return;
    const post = detail.post;
    if (!window.confirm('Nhân bản nội dung này thành một bài mới ở trạng thái chờ duyệt?')) return;

    setBusy(true);
    setError('');
    try {
      const created = await createMyPost({
        categoryId:post.categoryId,
        title:`${post.title} - bản sao`.slice(0, 160),
        description:post.description,
        tradeType:post.tradeType,
        salePrice:post.salePrice,
        visibilityScope:post.visibilityScope,
        preferredContactMethod:post.preferredContactMethod,
        originalPurchasePrice:post.originalPurchasePrice,
        originalPriceIsEstimate:post.originalPriceIsEstimate,
        purchaseDate:post.purchaseDate,
        conditionGrade:post.conditionGrade,
        brand:post.brand,
        model:post.model,
      });
      navigateLegacy('editPost', { id:created.id });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể nhân bản bài đăng.');
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <>
        <StudentHeader activePage="myDetail" />
        <main className="container ecom-page owner-detail-page"><div className="state">Đang tải chi tiết bài đăng…</div></main>
      </>
    );
  }

  if (error && !detail) {
    return (
      <>
        <StudentHeader activePage="myDetail" />
        <main className="container ecom-page owner-detail-page">
          <div className="state error">{error}</div>
          <div className="btn-row"><button className="btn gray" type="button" onClick={() => reload()}>Thử lại</button><button className="btn gray" type="button" onClick={() => navigateLegacy('myPosts')}>← Bài của tôi</button></div>
        </main>
      </>
    );
  }

  if (!detail) {
    return (
      <>
        <StudentHeader activePage="myDetail" />
        <main className="container ecom-page owner-detail-page">
          <section className="ecom-page-title"><div><span className="eyebrow">CHI TIẾT TIN ĐĂNG</span><h1>Chi tiết bài đăng của tôi</h1></div></section>
          <div className="state error">Không tìm thấy bài đăng thuộc tài khoản hiện tại.</div>
          <button className="btn gray" type="button" onClick={() => navigateLegacy('myPosts')}>← Bài của tôi</button>
        </main>
      </>
    );
  }

  const post = detail.post;
  const canEdit = post.lifecycleStatus === 'active';
  const canComplete = post.lifecycleStatus === 'active' && post.moderationStatus === 'approved';
  const isSale = post.tradeType === 'low_price_sale';

  return (
    <>
      <StudentHeader activePage="myDetail" />
      <main className="container ecom-page owner-detail-page">
        <section className="ecom-page-title">
          <div>
            <span className="eyebrow">CHI TIẾT TIN ĐĂNG</span>
            <h1>Chi tiết bài đăng của tôi</h1>
            <p>Trạng thái, lịch sử và ảnh bên dưới đến trực tiếp từ Supabase theo quyền owner.</p>
          </div>
          <div className="btn-row">
            <button className="btn gray" type="button" onClick={() => navigateLegacy('myPosts')}>← Bài của tôi</button>
            <button className="btn primary" type="button" onClick={() => navigateLegacy('add')}>+ Đăng bài</button>
          </div>
        </section>

        {notice ? <div className="state ok" role="status">{notice}</div> : null}
        {error ? <div className="state error" role="alert">{error}</div> : null}

        <section className="owner-detail-layout">
          <article className="card owner-detail-main">
            <div className="tags">
              <span className={moderationBadge(post.moderationStatus)}>{post.moderationLabel}</span>
              <span className={lifecycleBadge(post.lifecycleStatus)}>{post.lifecycleLabel}</span>
              {post.isHidden ? <span className="badge reject">Đang bị ẩn bởi kiểm duyệt</span> : null}
              <span className="tag price">{post.salePriceLabel}</span>
            </div>
            <h2 className="owner-detail-title">{post.title}</h2>
            <div className="meta">{post.tradeLabel} • {post.categoryName} • {post.className}</div>
            <div className="meta">Tạo: {post.createdAtLabel} • Cập nhật: {post.updatedAtLabel}</div>
            <div className="desc owner-desc">{post.description}</div>

            {detail.rejectionReason ? <div className="reason-box"><b>Lý do từ chối gần nhất: </b>{detail.rejectionReason}</div> : null}

            <section className="card">
              <h3>Chính sách và liên hệ</h3>
              <p><b>Phạm vi:</b> {post.visibilityScope}</p>
              <p><b>Kênh liên hệ đã chọn:</b> {contactLabel(post.preferredContactMethod)}</p>
              <p><b>Bình luận theo moderation:</b> {post.commentsEnabled ? 'Được bật' : 'Đang tắt'}</p>
              <p className="form-note">Thông tin liên hệ riêng tư không được sao chép vào bản ghi bài đăng.</p>
            </section>

            {isSale ? (
              <section className="card">
                <h3>Dữ liệu bán giá rẻ</h3>
                <div className="grid-2">
                  <p><b>Giá bán:</b> {post.salePriceLabel}</p>
                  <p><b>Giá mua ban đầu:</b> {post.originalPurchasePrice?.toLocaleString('vi-VN')} đ</p>
                  <p><b>Giá mua là ước tính:</b> {post.originalPriceIsEstimate ? 'Có' : 'Không'}</p>
                  <p><b>Tình trạng:</b> {post.conditionLabel}</p>
                  <p><b>Ngày mua:</b> {post.purchaseDate ?? 'Không cung cấp'}</p>
                  <p><b>Thương hiệu / model:</b> {[post.brand, post.model].filter(Boolean).join(' • ') || 'Không cung cấp'}</p>
                </div>
                <p className="form-note">Đây là dữ liệu đầu vào có cấu trúc; Core V2 chưa tự ước tính giá.</p>
              </section>
            ) : null}

            <div className="owner-action-panel">
              <h3>Thao tác với bài đăng</h3>
              <div className="actions owner-actions">
                {canEdit ? <button className="btn primary" type="button" onClick={() => navigateLegacy('editPost', { id:post.id })}>Chỉnh sửa & gửi duyệt lại</button> : null}
                <button className="btn" type="button" disabled={busy} onClick={() => void duplicatePost()}>Nhân bản bài</button>
                {canComplete ? <button className="btn green" type="button" disabled={busy} onClick={() => void runLifecycle('complete')}>Đánh dấu hoàn tất</button> : null}
                {canEdit ? <button className="btn danger" type="button" disabled={busy} onClick={() => void runLifecycle('withdraw')}>Thu hồi bài</button> : null}
              </div>
            </div>
          </article>

          <aside className="owner-detail-side">
            {media.length ? (
              <div className="owner-media-gallery">
                {media.map((item) => (
                  <img
                    className="owner-detail-img"
                    key={item.fileId}
                    src={item.signedUrl}
                    alt={item.altText || `Ảnh bài đăng ${item.sortOrder + 1}`}
                    loading="lazy"
                    decoding="async"
                  />
                ))}
              </div>
            ) : mediaError ? (
              <div className="state">{mediaError}</div>
            ) : (
              <div className="state">Bài đăng chưa có ảnh khả dụng.</div>
            )}
            <div className="state">Lượt lưu, yêu cầu liên hệ, bình luận và báo cáo sẽ được nối ở Phase 5G/5H. Chưa có số liệu giả trong trang này.</div>
          </aside>
        </section>

        <section className="card ecom-form-card">
          <h2>Lịch sử trạng thái</h2>
          <p className="form-note">Chỉ hiển thị các bản ghi `post_status_history` mà owner được phép đọc.</p>
          <div className="timeline">
            {detail.history.length ? detail.history.map((item) => (
              <div className="timeline-item" key={item.id}>
                <div className="timeline-dot" />
                <div className="timeline-body">
                  <b>{item.dimension}: {item.oldValue ?? '∅'} → {item.newValue}</b>
                  {item.reason ? <span>{item.reason}</span> : null}
                  <small>{formatHistoryTime(item.createdAt)}</small>
                </div>
              </div>
            )) : <div className="state">Chưa có lịch sử trạng thái cho bài này.</div>}
          </div>
        </section>
      </main>
      <footer className="page-footer">Edu Share+ • Chia sẻ đồ dùng học tập an toàn trong trường</footer>
    </>
  );
}
