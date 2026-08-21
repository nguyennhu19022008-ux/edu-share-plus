import { useEffect, useState } from 'react';
import { navigateLegacy } from '../app/legacyRouter';
import StudentHeader from '../components/student/StudentHeader';
import type {
  OwnerLifecycleStatus,
  OwnerModerationStatus,
  OwnerPostListResult,
  OwnerPostView,
} from '../features/my-posts/ownerPostModel';
import {
  changeMyPostLifecycle,
  createMyPost,
  listMyPosts,
} from '../features/my-posts/ownerPostService';

const EMPTY_RESULT:OwnerPostListResult = {
  items:[],
  totalCount:0,
  page:1,
  pageSize:12,
  totalPages:0,
};

function moderationBadge(status:OwnerModerationStatus):string {
  if (status === 'approved') return 'badge open';
  if (status === 'pending') return 'badge pending';
  return 'badge reject';
}

function lifecycleBadge(status:OwnerLifecycleStatus):string {
  if (status === 'active') return 'badge open';
  return 'badge done';
}

export default function MyPostsPage() {
  const pageSize = 12;
  const [keyword, setKeyword] = useState('');
  const [moderationStatus, setModerationStatus] = useState<'' | OwnerModerationStatus>('');
  const [lifecycleStatus, setLifecycleStatus] = useState<'' | OwnerLifecycleStatus>('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<OwnerPostListResult>(EMPTY_RESULT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reloadVersion, setReloadVersion] = useState(0);
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    void listMyPosts({ keyword, moderationStatus, lifecycleStatus, page, pageSize })
      .then((nextResult) => {
        if (!cancelled) setResult(nextResult);
      })
      .catch((reason:unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Không thể tải bài đăng.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [keyword, lifecycleStatus, moderationStatus, page, reloadVersion]);

  const reload = (message?:string) => {
    if (message) setNotice(message);
    setReloadVersion((value) => value + 1);
  };

  const changeLifecycle = async (post:OwnerPostView, action:'complete' | 'withdraw') => {
    const prompt = action === 'complete'
      ? 'Xác nhận giao dịch/chia sẻ đã hoàn tất? Bài sẽ chuyển sang lịch sử.'
      : 'Thu hồi bài đăng này? Bài sẽ không còn hoạt động trên Marketplace.';
    if (!window.confirm(prompt)) return;

    setBusyId(post.id);
    setNotice('');
    try {
      await changeMyPostLifecycle(post.id, action);
      reload(action === 'complete' ? 'Đã đánh dấu bài hoàn tất.' : 'Đã thu hồi bài đăng.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể cập nhật vòng đời bài đăng.');
    } finally {
      setBusyId('');
    }
  };

  const duplicatePost = async (post:OwnerPostView) => {
    if (!window.confirm('Nhân bản nội dung bài này thành một bài mới ở trạng thái chờ duyệt?')) return;
    setBusyId(post.id);
    setNotice('');
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
      setBusyId('');
    }
  };

  const clearFilters = () => {
    setKeyword('');
    setModerationStatus('');
    setLifecycleStatus('');
    setPage(1);
  };

  return (
    <>
      <StudentHeader activePage="myPosts" />
      <main className="container ecom-page owner-page">
        <section className="ecom-page-title">
          <div>
            <span className="eyebrow">QUẢN LÝ TIN ĐĂNG</span>
            <h1>Bài đăng của tôi</h1>
            <p>Dữ liệu được tải trực tiếp từ Supabase theo tài khoản đang đăng nhập.</p>
          </div>
          <button className="btn primary" type="button" onClick={() => navigateLegacy('add')}>+ Đăng bài mới</button>
        </section>

        <section className="stats-grid compact">
          <div className="card stat-card"><span>Kết quả theo bộ lọc</span><strong>{result.totalCount}</strong></div>
          <div className="card stat-card"><span>Trang hiện tại</span><strong>{result.totalPages ? `${result.page}/${result.totalPages}` : '0/0'}</strong></div>
        </section>

        <section className="card ecom-form-card">
          <div className="grid-2">
            <div className="field">
              <label htmlFor="owner-keyword">Tìm trong bài của tôi</label>
              <input
                id="owner-keyword"
                value={keyword}
                onChange={(event) => { setKeyword(event.target.value); setPage(1); }}
                placeholder="Tiêu đề hoặc mô tả"
              />
            </div>
            <div className="field">
              <label htmlFor="owner-moderation">Kiểm duyệt</label>
              <select id="owner-moderation" value={moderationStatus} onChange={(event) => { setModerationStatus(event.target.value as '' | OwnerModerationStatus); setPage(1); }}>
                <option value="">Tất cả</option>
                <option value="pending">Chờ duyệt</option>
                <option value="approved">Đã duyệt</option>
                <option value="rejected">Từ chối</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="owner-lifecycle">Vòng đời</label>
              <select id="owner-lifecycle" value={lifecycleStatus} onChange={(event) => { setLifecycleStatus(event.target.value as '' | OwnerLifecycleStatus); setPage(1); }}>
                <option value="">Tất cả</option>
                <option value="active">Đang hoạt động</option>
                <option value="completed">Đã hoàn tất</option>
                <option value="withdrawn">Đã thu hồi</option>
              </select>
            </div>
            <div className="field">
              <label>&nbsp;</label>
              <button className="btn gray" type="button" onClick={clearFilters}>Xóa bộ lọc</button>
            </div>
          </div>
        </section>

        <div className="state">Media/ảnh bài đăng sẽ được nối thật ở Phase 5F; danh sách này không tạo URL ảnh giả.</div>
        {notice ? <div className="state ok" role="status">{notice}</div> : null}
        {error ? <div className="state error" role="alert">{error}<div className="btn-row"><button className="btn gray" type="button" onClick={() => reload()}>Thử lại</button></div></div> : null}
        {loading ? <div className="state">Đang tải bài đăng…</div> : null}

        {!loading && !error ? (
          <section className="owner-post-grid">
            {result.items.length ? result.items.map((post) => (
              <article className="card owner-post-card" key={post.id}>
                <div className="tags">
                  <span className={moderationBadge(post.moderationStatus)}>{post.moderationLabel}</span>
                  <span className={lifecycleBadge(post.lifecycleStatus)}>{post.lifecycleLabel}</span>
                  {post.isHidden ? <span className="badge reject">Đang bị ẩn bởi kiểm duyệt</span> : null}
                </div>
                <h2>{post.title}</h2>
                <div className="meta">{post.tradeLabel} • {post.categoryName} • {post.className}</div>
                <div className="meta">Tạo: {post.createdAtLabel} • Cập nhật: {post.updatedAtLabel}</div>
                <div className="tags"><span className="tag price">{post.salePriceLabel}</span><span className="tag">{post.visibilityScope}</span></div>
                <p className="desc">{post.description}</p>
                <div className="actions owner-actions">
                  <button className="btn gray" type="button" onClick={() => navigateLegacy('myDetail', { id:post.id })}>Chi tiết</button>
                  {post.lifecycleStatus === 'active' ? <button className="btn primary" type="button" onClick={() => navigateLegacy('editPost', { id:post.id })}>Chỉnh sửa</button> : null}
                  <button className="btn" type="button" disabled={busyId === post.id} onClick={() => void duplicatePost(post)}>Nhân bản</button>
                  {post.lifecycleStatus === 'active' ? <button className="btn green" type="button" disabled={busyId === post.id} onClick={() => void changeLifecycle(post, 'complete')}>Đánh dấu hoàn tất</button> : null}
                  {post.lifecycleStatus === 'active' ? <button className="btn danger" type="button" disabled={busyId === post.id} onClick={() => void changeLifecycle(post, 'withdraw')}>Thu hồi</button> : null}
                </div>
              </article>
            )) : <div className="state">Bạn chưa có bài đăng phù hợp với bộ lọc này.</div>}
          </section>
        ) : null}

        {result.totalPages > 1 ? (
          <nav className="pager" aria-label="Phân trang bài của tôi">
            <button className="btn gray" type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>← Trang trước</button>
            <span>Trang {result.page} / {result.totalPages}</span>
            <button className="btn gray" type="button" disabled={page >= result.totalPages || loading} onClick={() => setPage((value) => value + 1)}>Trang sau →</button>
          </nav>
        ) : null}
      </main>
      <footer className="page-footer">Edu Share+ • Chia sẻ đồ dùng học tập an toàn trong trường</footer>
    </>
  );
}
