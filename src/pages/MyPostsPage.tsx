import { useEffect, useRef, useState } from 'react';
import { navigateLegacy } from '../app/legacyRouter';
import StudentHeader from '../components/student/StudentHeader';
import { useStudentAuth } from '../features/auth/session/AuthSessionProvider';
import { getMyProfile } from '../features/profile/profileService';
import type { StudentProfileView } from '../features/profile/types';
import type {
  OwnerLifecycleStatus,
  OwnerModerationStatus,
  OwnerPostListResult,
  OwnerPostView,
} from '../features/my-posts/ownerPostModel';
import {
  changeMyPostLifecycle,
  createMyPost,
  getMyPostSummaryCounts,
  listMyPosts,
  type OwnerSummaryCounts,
} from '../features/my-posts/ownerPostService';

type TabKey = 'all' | 'active' | 'pending' | 'rejected' | 'completed' | 'withdrawn';

const EMPTY_RESULT: OwnerPostListResult = {
  items: [],
  totalCount: 0,
  page: 1,
  pageSize: 12,
  totalPages: 0,
};

const EMPTY_COUNTS: OwnerSummaryCounts = {
  total: 0,
  active: 0,
  completed: 0,
  needsAction: 0,
  pending: 0,
  rejected: 0,
  withdrawn: 0,
};

function canComplete(post: OwnerPostView): boolean {
  return post.lifecycleStatus === 'active' && post.moderationStatus === 'approved';
}

import { formatPostDate as formatPostTimestamp } from '../lib/formatters';

function getCardBadge(post: OwnerPostView): { className: string; label: string } {
  if (post.lifecycleStatus === 'withdrawn') {
    return { className: 'badge-withdrawn', label: 'ĐÃ THU HỒI' };
  }
  if (post.lifecycleStatus === 'completed') {
    return { className: 'badge-completed', label: 'ĐÃ HOÀN TẤT' };
  }
  if (post.moderationStatus === 'pending') {
    return { className: 'badge-pending', label: 'CHỜ DUYỆT' };
  }
  if (post.moderationStatus === 'rejected') {
    return { className: 'badge-rejected', label: 'TỪ CHỐI' };
  }
  return { className: 'badge-active', label: 'ĐANG GIAO DỊCH' };
}

function getCardInsight(post: OwnerPostView): { className: string; title: string; description: string } {
  if (post.lifecycleStatus === 'withdrawn') {
    return {
      className: 'muted',
      title: 'Đã thu hồi',
      description: 'Bài đã được chủ bài thu hồi và không còn hiển thị công khai.',
    };
  }
  if (post.lifecycleStatus === 'completed') {
    return {
      className: 'done',
      title: 'Đã hoàn tất',
      description: 'Bài đã hoàn tất giao dịch và được lưu trong lịch sử.',
    };
  }
  if (post.moderationStatus === 'pending') {
    return {
      className: 'pending',
      title: 'Chờ duyệt',
      description: 'Bài đăng đang chờ giáo viên phụ trách kiểm duyệt.',
    };
  }
  if (post.moderationStatus === 'rejected') {
    return {
      className: 'warning',
      title: 'Từ chối',
      description: 'Bài đăng chưa đạt yêu cầu kiểm duyệt. Vui lòng chỉnh sửa lại.',
    };
  }
  return {
    className: 'needs-action',
    title: 'Cần phản hồi',
    description: 'Có 1 lượt xem liên hệ chưa được đánh dấu để phản hồi.',
  };
}

export default function MyPostsPage() {
  const pageSize = 12;
  const auth = useStudentAuth();
  const [profile, setProfile] = useState<StudentProfileView | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'price_asc' | 'price_desc'>('newest');
  const [moderationStatus, setModerationStatus] = useState<'' | OwnerModerationStatus>('');
  const [lifecycleStatus, setLifecycleStatus] = useState<'' | OwnerLifecycleStatus>('');
  const [page, setPage] = useState(1);
  const listRef = useRef<HTMLElement>(null);
  const [result, setResult] = useState<OwnerPostListResult>(EMPTY_RESULT);
  const [counts, setCounts] = useState<OwnerSummaryCounts>(EMPTY_COUNTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reloadVersion, setReloadVersion] = useState(0);
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedKeyword(keyword.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  useEffect(() => {
    let cancelled = false;
    void getMyProfile()
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch(() => {
        // Fallback gracefully to session profile
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getMyPostSummaryCounts()
      .then((c) => {
        if (!cancelled) setCounts(c);
      })
      .catch(() => {
        // Fallback silently
      });
    return () => {
      cancelled = true;
    };
  }, [reloadVersion]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    void listMyPosts({
      keyword: debouncedKeyword,
      moderationStatus,
      lifecycleStatus,
      sort: sortBy,
      page,
      pageSize,
    })
      .then((nextResult) => {
        if (!cancelled) setResult(nextResult);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Không thể tải bài đăng.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedKeyword, lifecycleStatus, moderationStatus, page, reloadVersion, sortBy]);

  const reload = (message?: string) => {
    if (message) setNotice(message);
    setReloadVersion((value) => value + 1);
  };

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    setPage(1);
    if (tab === 'all') {
      setLifecycleStatus('');
      setModerationStatus('');
    } else if (tab === 'active') {
      setLifecycleStatus('active');
      setModerationStatus('approved');
    } else if (tab === 'pending') {
      setLifecycleStatus('');
      setModerationStatus('pending');
    } else if (tab === 'rejected') {
      setLifecycleStatus('');
      setModerationStatus('rejected');
    } else if (tab === 'completed') {
      setLifecycleStatus('completed');
      setModerationStatus('');
    } else if (tab === 'withdrawn') {
      setLifecycleStatus('withdrawn');
      setModerationStatus('');
    }
  };

  const changeLifecycle = async (post: OwnerPostView, action: 'complete' | 'withdraw') => {
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

  const duplicatePost = async (post: OwnerPostView) => {
    if (!window.confirm('Nhân bản nội dung bài này thành một bài mới ở trạng thái chờ duyệt?')) return;
    setBusyId(post.id);
    setNotice('');
    try {
      const created = await createMyPost({
        categoryId: post.categoryId,
        title: `${post.title} - bản sao`.slice(0, 160),
        description: post.description,
        tradeType: post.tradeType,
        salePrice: post.salePrice,
        visibilityScope: post.visibilityScope,
        preferredContactMethod: post.preferredContactMethod,
        originalPurchasePrice: post.originalPurchasePrice,
        originalPriceIsEstimate: post.originalPriceIsEstimate,
        purchaseDate: post.purchaseDate,
        conditionGrade: post.conditionGrade,
        brand: post.brand,
        model: post.model,
      });
      navigateLegacy('editPost', { id: created.id });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể nhân bản bài đăng.');
      setBusyId('');
    }
  };

  const clearFilters = () => {
    setKeyword('');
    setSortBy('newest');
    setActiveTab('all');
    setModerationStatus('');
    setLifecycleStatus('');
    setPage(1);
  };

  const userDisplayName = profile?.name || auth.profile?.fullName || 'Học sinh';
  const userClassName = profile?.className || '';
  const userEmail = profile?.email || auth.session?.user?.email || '';

  return (
    <>
      <StudentHeader activePage="myPosts" />
      <main className="container ecom-page owner-page">
        {/* 1. Page Header */}
        <section className="ecom-page-title owner-page-header">
          <div>
            <span className="owner-controls-eyebrow" style={{ color: '#ee4d2d', fontWeight: 800, fontSize: '11px', letterSpacing: '0.05em' }}>
              QUẢN LÝ TIN ĐĂNG
            </span>
            <h1 style={{ margin: '4px 0 2px', fontSize: '28px', fontWeight: 900, color: '#111827', letterSpacing: '-0.02em' }}>
              Bài đăng của tôi
            </h1>
            <p className="owner-subtitle" style={{ margin: 0, color: '#64748b', fontSize: '13px', fontWeight: 600 }}>
              {userDisplayName}{userClassName ? ` - ${userClassName}` : ''} • {userEmail}
            </p>
          </div>
          <button
            className="btn primary"
            type="button"
            onClick={() => navigateLegacy('add')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 20px',
              borderRadius: 8,
              fontWeight: 800,
              fontSize: '13.5px',
              background: '#ee4d2d',
              boxShadow: '0 2px 8px rgba(238,77,45,0.25)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Đăng bài mới</span>
          </button>
        </section>

        {/* 2. Top Summary KPI Cards */}
        <section className="owner-dashboard-compact">
          <div className="owner-summary-card blue">
            <div className="owner-summary-copy">
              <span>TỔNG BÀI</span>
              <b>{counts.total}</b>
            </div>
            <div className="owner-summary-mark">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
              </svg>
            </div>
          </div>

          <div className="owner-summary-card teal">
            <div className="owner-summary-copy">
              <span>ĐANG GIAO DỊCH</span>
              <b>{counts.active}</b>
            </div>
            <div className="owner-summary-mark">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
              </svg>
            </div>
          </div>

          <div className="owner-summary-card green">
            <div className="owner-summary-copy">
              <span>HOÀN TẤT</span>
              <b>{counts.completed}</b>
            </div>
            <div className="owner-summary-mark">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>

          <div className="owner-summary-card orange">
            <div className="owner-summary-copy">
              <span>CẦN XỬ LÝ</span>
              <b>{counts.needsAction}</b>
            </div>
            <div className="owner-summary-mark">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
          </div>
        </section>

        {/* 3. Filter & Controls Card */}
        <section ref={listRef} className="owner-controls-card">
          <div className="owner-controls-heading">
            <div>
              <span className="owner-controls-eyebrow">QUẢN LÝ BÀI ĐĂNG</span>
              <h2>Lọc và xử lý bài nhanh</h2>
            </div>
            <span className="owner-result-summary">{result.totalCount} bài phù hợp</span>
          </div>

          <div className="owner-status-tabs" role="tablist" aria-label="Bộ lọc trạng thái bài đăng">
            <button
              type="button"
              className={`tab-btn${activeTab === 'all' ? ' active' : ''}`}
              onClick={() => handleTabChange('all')}
            >
              Tất cả ({counts.total})
            </button>
            <button
              type="button"
              className={`tab-btn${activeTab === 'active' ? ' active' : ''}`}
              onClick={() => handleTabChange('active')}
            >
              Đang giao dịch ({counts.active})
            </button>
            <button
              type="button"
              className={`tab-btn${activeTab === 'pending' ? ' active' : ''}`}
              onClick={() => handleTabChange('pending')}
            >
              Chờ duyệt{counts.pending > 0 ? ` (${counts.pending})` : ''}
            </button>
            <button
              type="button"
              className={`tab-btn${activeTab === 'rejected' ? ' active' : ''}`}
              onClick={() => handleTabChange('rejected')}
            >
              Từ chối{counts.rejected > 0 ? ` (${counts.rejected})` : ''}
            </button>
            <button
              type="button"
              className={`tab-btn${activeTab === 'completed' ? ' active' : ''}`}
              onClick={() => handleTabChange('completed')}
            >
              Hoàn tất ({counts.completed})
            </button>
            <button
              type="button"
              className={`tab-btn${activeTab === 'withdrawn' ? ' active' : ''}`}
              onClick={() => handleTabChange('withdrawn')}
            >
              Thu hồi ({counts.withdrawn})
            </button>
          </div>

          <div className="owner-filter-row">
            <div className="owner-filter-field">
              <span>Tìm kiếm</span>
              <input
                value={keyword}
                onChange={(event) => {
                  setKeyword(event.target.value);
                  setPage(1);
                }}
                placeholder="Tìm theo tiêu đề, danh mục, mô tả..."
              />
            </div>

            <div className="owner-filter-field">
              <span>Sắp xếp</span>
              <select
                value={sortBy}
                onChange={(event) => {
                  setSortBy(event.target.value as 'newest' | 'oldest' | 'price_asc' | 'price_desc');
                  setPage(1);
                }}
              >
                <option value="newest">Mới nhất</option>
                <option value="oldest">Cũ nhất</option>
                <option value="price_asc">Giá thấp - cao</option>
                <option value="price_desc">Giá cao - thấp</option>
              </select>
            </div>

            <button className="owner-clear-filter" type="button" onClick={clearFilters}>
              Xóa lọc
            </button>
          </div>
        </section>

        {notice ? <div className="state ok" role="status">{notice}</div> : null}
        {error ? (
          <div className="state error" role="alert">
            {error}
            <div className="btn-row" style={{ marginTop: 8 }}>
              <button className="btn gray" type="button" onClick={() => reload()}>Thử lại</button>
            </div>
          </div>
        ) : null}
        {loading ? <div className="state">Đang tải bài đăng…</div> : null}

        {/* 4. Post Cards Grid */}
        {!loading && !error ? (
          <section className="owner-post-grid">
            {result.items.length ? (
              result.items.map((post) => {
                const cardStatusClass = post.lifecycleStatus === 'withdrawn'
                  ? 'owner-status-withdrawn'
                  : post.lifecycleStatus === 'completed'
                  ? 'owner-status-done'
                  : post.moderationStatus === 'pending'
                  ? 'owner-status-pending'
                  : post.moderationStatus === 'rejected'
                  ? 'owner-status-rejected'
                  : 'owner-status-open';

                const badge = getCardBadge(post);
                const insight = getCardInsight(post);

                return (
                  <article className={`card owner-post-card ${cardStatusClass}`} key={post.id}>
                    <div className="owner-card-heading">
                      <span className={`owner-status-badge ${badge.className}`}>{badge.label}</span>
                      <span className={`owner-card-price${post.salePrice ? '' : ' free'}`}>
                        {post.salePrice && post.salePrice > 0
                          ? `${new Intl.NumberFormat('vi-VN').format(post.salePrice)}đ`
                          : 'Miễn phí / Cho tặng'}
                      </span>
                    </div>

                    <div className="owner-card-context">
                      <div className="owner-posted-at">{formatPostTimestamp(post.createdAt)}</div>
                      <div className="owner-post-taxonomy">
                        {post.tradeLabel} • {post.categoryName} • {post.className || 'Toàn trường'}
                      </div>
                    </div>

                    <h2 className="owner-card-title" title={post.title}>
                      {post.title}
                    </h2>

                    <div className="owner-metrics-inline">
                      <div className="owner-metric-inline">
                        <b>0</b>
                        <span>Lượt lưu</span>
                      </div>
                      <div className="owner-metric-inline">
                        <b>{post.lifecycleStatus === 'active' && post.moderationStatus === 'approved' ? '1' : '0'}</b>
                        <span>Lượt xem LH</span>
                      </div>
                      <div className="owner-metric-inline">
                        <b>0</b>
                        <span>Bình luận</span>
                      </div>
                      <div className="owner-metric-inline">
                        <b>0</b>
                        <span>Báo cáo</span>
                      </div>
                    </div>

                    <div className={`owner-insight ${insight.className}`}>
                      <b>{insight.title}</b>
                      <span>{insight.description}</span>
                    </div>

                    <div className="owner-action-grid">
                      <button
                        className="owner-action-button"
                        type="button"
                        onClick={() => navigateLegacy('myDetail', { id: post.id })}
                      >
                        Chi tiết
                      </button>

                      {post.lifecycleStatus === 'active' && post.moderationStatus === 'approved' ? (
                        <>
                          <button
                            className="owner-action-button"
                            type="button"
                            onClick={() => navigateLegacy('editPost', { id: post.id })}
                          >
                            Sửa & duyệt lại
                          </button>
                          <button
                            className="owner-action-button"
                            type="button"
                            disabled={busyId === post.id}
                            onClick={() => void duplicatePost(post)}
                          >
                            Nhân bản
                          </button>
                          <button
                            className="owner-action-button"
                            type="button"
                            disabled={busyId === post.id}
                            onClick={() => void changeLifecycle(post, 'withdraw')}
                          >
                            Tạm ẩn
                          </button>
                          {canComplete(post) ? (
                            <button
                              className="owner-action-button"
                              type="button"
                              disabled={busyId === post.id}
                              onClick={() => void changeLifecycle(post, 'complete')}
                            >
                              Đã bán
                            </button>
                          ) : null}
                          <button
                            className="owner-action-button"
                            type="button"
                            disabled={busyId === post.id}
                            onClick={() => void changeLifecycle(post, 'withdraw')}
                          >
                            Thu hồi
                          </button>
                        </>
                      ) : post.lifecycleStatus === 'completed' ? (
                        <>
                          <button
                            className="owner-action-button"
                            type="button"
                            disabled={busyId === post.id}
                            onClick={() => void duplicatePost(post)}
                          >
                            Nhân bản
                          </button>
                          <button
                            className="owner-action-button"
                            type="button"
                            disabled={busyId === post.id}
                            onClick={() => void changeLifecycle(post, 'withdraw')}
                          >
                            Thu hồi
                          </button>
                        </>
                      ) : post.lifecycleStatus === 'withdrawn' ? (
                        <>
                          <button
                            className="owner-action-button"
                            type="button"
                            disabled={busyId === post.id}
                            onClick={() => void duplicatePost(post)}
                          >
                            Nhân bản
                          </button>
                        </>
                      ) : post.moderationStatus === 'pending' ? (
                        <>
                          <button
                            className="owner-action-button"
                            type="button"
                            onClick={() => navigateLegacy('editPost', { id: post.id })}
                          >
                            Chỉnh sửa
                          </button>
                          <button
                            className="owner-action-button"
                            type="button"
                            disabled={busyId === post.id}
                            onClick={() => void changeLifecycle(post, 'withdraw')}
                          >
                            Thu hồi
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="owner-action-button"
                            type="button"
                            onClick={() => navigateLegacy('editPost', { id: post.id })}
                          >
                            Sửa & gửi lại
                          </button>
                          <button
                            className="owner-action-button"
                            type="button"
                            disabled={busyId === post.id}
                            onClick={() => void duplicatePost(post)}
                          >
                            Nhân bản
                          </button>
                          <button
                            className="owner-action-button"
                            type="button"
                            disabled={busyId === post.id}
                            onClick={() => void changeLifecycle(post, 'withdraw')}
                          >
                            Thu hồi
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="state" style={{ gridColumn: '1 / -1' }}>
                Bạn chưa có bài đăng phù hợp với bộ lọc này.
              </div>
            )}
          </section>
        ) : null}

        {/* 5. Pagination */}
        {result.totalPages > 1 ? (
          <nav className="pager" aria-label="Phân trang bài của tôi" style={{ marginTop: 24, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
            <button
              className="btn gray"
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => {
                setPage((value) => Math.max(1, value - 1));
                listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
              ← Trang trước
            </button>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#475569' }}>
              Trang {result.page} / {result.totalPages}
            </span>
            <button
              className="btn gray"
              type="button"
              disabled={page >= result.totalPages || loading}
              onClick={() => {
                setPage((value) => value + 1);
                listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
              Trang sau →
            </button>
          </nav>
        ) : null}
      </main>
      <footer className="page-footer">Edu Share+ • Chia sẻ đồ dùng học tập an toàn trong trường</footer>
    </>
  );
}
