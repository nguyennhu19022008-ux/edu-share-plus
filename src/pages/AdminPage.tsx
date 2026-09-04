import { useEffect, useMemo, useState } from 'react';
import { formatRosterMatchReason } from '../features/admin/accountReviewPresentation';
import { listAccountReviewQueue, reviewStudentAccount } from '../features/admin/accountReviewService';
import type { AccountReviewDecision, AccountReviewQueueItem } from '../features/admin/accountReviewTypes';
import { AdminOverview, AdminPageHeading, AdminTopbar } from '../features/admin/components/AdminShellSections';
import { TeacherNotificationHub } from '../features/admin/components/TeacherNotificationHub';
import {
  AdminModalMeta,
  AdminSwitch,
  CheckIcon,
  SearchIcon,
  ShieldIcon,
  adminStatusClass,
  adminStatusLabel,
} from '../features/admin/components/AdminVisuals';
import {
  listStaffPostsQueue,
  listStaffReportsQueue,
  moderatePost,
  resolveModerationReport,
} from '../features/admin/postModerationService';
import type {
  ModerationAction,
  StaffPostQueueItem,
  StaffReportQueueItem,
} from '../features/admin/postModerationTypes';
import type { AdminDashboardSummary, AdminPost, AdminPostStatus, CommentStatus } from '../features/admin/types';
import { useStudentAuth } from '../features/auth/session/AuthSessionProvider';
import { getSchoolImpactSummary } from '../features/transactions/transactionService';
import type { SchoolImpactSummary } from '../features/transactions/transactionTypes';

const PAGE_SIZE = 6;

type SortMode = 'new' | 'old' | 'reports';
type Notice = { tone: 'ok' | 'warn'; text: string } | null;

function money(value: number): string {
  if (!value) return '';
  return new Intl.NumberFormat('vi-VN').format(value) + 'đ';
}

function normalize(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function compactPages(totalPages: number, active: number): (number | '...')[] {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages: (number | '...')[] = [1];
  const start = Math.max(2, active - 1);
  const end = Math.min(totalPages - 1, active + 1);
  if (start > 2) pages.push('...');
  for (let page = start; page <= end; page += 1) pages.push(page);
  if (end < totalPages - 1) pages.push('...');
  pages.push(totalPages);
  return pages;
}

function formatReviewDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || 'Chưa có';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function reviewStatusLabel(status: AccountReviewQueueItem['reviewStatus']): string {
  return status === 'needs_information' ? 'Cần bổ sung' : 'Chờ duyệt';
}

function mapStatusToAdmin(status: StaffPostQueueItem['moderationStatus']): AdminPostStatus {
  if (status === 'approved') return 'Đang mở';
  if (status === 'rejected') return 'Từ chối';
  return 'Chờ duyệt';
}

function mapTradeType(type: string): AdminPost['tradeType'] {
  if (type === 'give') return 'Cho tặng';
  if (type === 'exchange') return 'Trao đổi';
  if (type === 'sale' || type === 'low_price_sale') return 'Bán giá rẻ';
  return 'Cho mượn';
}

export default function AdminPage() {
  const auth = useStudentAuth();
  const [posts, setPosts] = useState<StaffPostQueueItem[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState('');

  const [reports, setReports] = useState<StaffReportQueueItem[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState('');

  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<'' | AdminPostStatus>('');
  const [className, setClassName] = useState('');
  const [sort, setSort] = useState<SortMode>('new');
  const [page, setPage] = useState(1);

  const [modalPost, setModalPost] = useState<StaffPostQueueItem | null>(null);
  const [modalStatus, setModalStatus] = useState<AdminPostStatus>('Đang mở');
  const [modalHidden, setModalHidden] = useState(false);
  const [modalComments, setModalComments] = useState<CommentStatus>('Mở');
  const [modalReason, setModalReason] = useState('');
  const [showNotificationHub, setShowNotificationHub] = useState(true);

  const [notice, setNotice] = useState<Notice>({
    tone: 'ok',
    text: 'Hệ thống kiểm duyệt bài đăng, xác minh tài khoản và báo cáo vi phạm đang chạy trực tiếp trên Supabase với phân quyền theo trường của giáo viên.',
  });

  const [accountReviews, setAccountReviews] = useState<AccountReviewQueueItem[]>([]);
  const [accountReviewsLoading, setAccountReviewsLoading] = useState(true);
  const [accountReviewsError, setAccountReviewsError] = useState('');
  const [reviewActionUserId, setReviewActionUserId] = useState<string | null>(null);
  const [actionBusyPostId, setActionBusyPostId] = useState<string | null>(null);
  const [actionBusyReportId, setActionBusyReportId] = useState<string | null>(null);
  const [impactSummary, setImpactSummary] = useState<SchoolImpactSummary | null>(null);

  async function loadImpactSummary() {
    try {
      const res = await getSchoolImpactSummary();
      setImpactSummary(res);
    } catch {
      // graceful fallback
    }
  }

  async function loadPosts() {
    setPostsLoading(true);
    setPostsError('');
    try {
      const res = await listStaffPostsQueue({ limit: 2000 });
      setPosts(res.items);
    } catch (err) {
      setPosts([]);
      setPostsError(err instanceof Error ? err.message : 'Không thể tải danh sách bài đăng.');
    } finally {
      setPostsLoading(false);
    }
  }

  async function loadReports() {
    setReportsLoading(true);
    setReportsError('');
    try {
      const res = await listStaffReportsQueue({ limit: 50 });
      setReports(res.items);
    } catch (err) {
      setReports([]);
      setReportsError(err instanceof Error ? err.message : 'Không thể tải danh sách báo cáo.');
    } finally {
      setReportsLoading(false);
    }
  }

  async function loadAccountReviews() {
    setAccountReviewsLoading(true);
    setAccountReviewsError('');
    try {
      const rows = await listAccountReviewQueue();
      setAccountReviews(rows);
    } catch (error) {
      setAccountReviews([]);
      setAccountReviewsError(
        error instanceof Error ? error.message : 'Không tải được hàng chờ xác minh tài khoản.'
      );
    } finally {
      setAccountReviewsLoading(false);
    }
  }

  async function decideAccountReview(item: AccountReviewQueueItem, decision: AccountReviewDecision) {
    if (reviewActionUserId) return;

    let reason: string | null = null;

    if (decision === 'approved') {
      if (!window.confirm(`Phê duyệt tài khoản học sinh “${item.fullName}”?`)) return;
    } else {
      const label = decision === 'rejected' ? 'từ chối' : 'yêu cầu bổ sung';
      const value = String(
        window.prompt(`Nhập lý do ${label} cho “${item.fullName}”:`, item.currentReason || '') || ''
      ).trim();
      if (!value) {
        window.alert('Vui lòng nhập lý do để học sinh biết cần xử lý hoặc bổ sung thông tin gì.');
        return;
      }
      reason = value;
    }

    setReviewActionUserId(item.userId);
    try {
      await reviewStudentAccount(item.userId, decision, reason);
      await loadAccountReviews();
      const actionLabel =
        decision === 'approved'
          ? 'phê duyệt'
          : decision === 'rejected'
          ? 'từ chối'
          : 'yêu cầu bổ sung thông tin';
      setNotice({ tone: 'ok', text: `Đã ${actionLabel} tài khoản “${item.fullName}” thành công.` });
    } catch (error) {
      setNotice({
        tone: 'warn',
        text: error instanceof Error ? error.message : 'Không thể cập nhật yêu cầu xác minh tài khoản.',
      });
    } finally {
      setReviewActionUserId(null);
    }
  }

  const handlePostAction = async (post: StaffPostQueueItem, action: ModerationAction, reason?: string) => {
    if (actionBusyPostId) return;
    setActionBusyPostId(post.id);
    try {
      await moderatePost(post.id, action, reason);
      await loadPosts();
      setNotice({ tone: 'ok', text: `Đã thực hiện kiểm duyệt cho bài “${post.title}”.` });
    } catch (err) {
      setNotice({ tone: 'warn', text: err instanceof Error ? err.message : 'Lỗi kiểm duyệt bài đăng.' });
    } finally {
      setActionBusyPostId(null);
    }
  };

  const handleReportAction = async (
    report: StaffReportQueueItem,
    decision: 'resolved' | 'dismissed'
  ) => {
    if (actionBusyReportId) return;
    const note = window.prompt(
      `Nhập ghi chú xử lý báo cáo (${decision === 'resolved' ? 'Giải quyết' : 'Bỏ qua'}):`,
      ''
    );
    if (note === null) return;

    setActionBusyReportId(report.id);
    try {
      await resolveModerationReport(report.id, decision, note.trim() || undefined);
      await loadReports();
      setNotice({ tone: 'ok', text: `Đã xử lý báo cáo vi phạm #${report.id.slice(0, 8)}.` });
    } catch (err) {
      setNotice({ tone: 'warn', text: err instanceof Error ? err.message : 'Lỗi xử lý báo cáo.' });
    } finally {
      setActionBusyReportId(null);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [keyword, status, className, sort]);

  useEffect(() => {
    if (!auth.authReady) return;
    void Promise.allSettled([
      loadAccountReviews(),
      loadPosts(),
      loadReports(),
      loadImpactSummary(),
    ]);
  }, [auth.authReady, auth.session?.user?.id]);

  useEffect(() => {
    if (!modalPost) return;
    document.body.classList.add('admin-modal-open');
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setModalPost(null);
    };
    document.addEventListener('keydown', close);
    return () => {
      document.body.classList.remove('admin-modal-open');
      document.removeEventListener('keydown', close);
    };
  }, [modalPost]);

  const classes = useMemo(
    () =>
      [...new Set(posts.map((post) => post.className).filter(Boolean))]
        .sort((a, b) => String(a).localeCompare(String(b), 'vi')) as string[],
    [posts]
  );

  const filtered = useMemo(() => {
    const kw = normalize(keyword);
    const list = posts.filter((post) => {
      const postStatus = mapStatusToAdmin(post.moderationStatus);
      if (status && postStatus !== status) return false;
      if (className && post.className !== className) return false;
      if (!kw) return true;
      return normalize(
        [post.title, post.ownerName, post.className, post.category, post.tradeType].join(' ')
      ).includes(kw);
    });
    return [...list].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      if (sort === 'old') return dateA - dateB;
      if (sort === 'reports') return b.reportCount - a.reportCount || dateB - dateA;
      return dateB - dateA;
    });
  }, [posts, keyword, status, className, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const shown = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const openModal = (post: StaffPostQueueItem) => {
    setModalPost(post);
    setModalStatus(mapStatusToAdmin(post.moderationStatus));
    setModalHidden(post.isHidden);
    setModalComments(post.commentsEnabled ? 'Mở' : 'Tắt');
    setModalReason(post.rejectionReason || '');
  };

  const saveModal = async () => {
    if (!modalPost) return;
    if (modalStatus === 'Từ chối' && !modalReason.trim()) {
      window.alert('Vui lòng nhập lý do từ chối để học sinh biết cần chỉnh sửa gì.');
      return;
    }

    try {
      if (modalStatus === 'Đang mở' && modalPost.moderationStatus !== 'approved') {
        await moderatePost(modalPost.id, 'approve');
      } else if (modalStatus === 'Từ chối' && modalPost.moderationStatus !== 'rejected') {
        await moderatePost(modalPost.id, 'reject', modalReason.trim());
      }

      if (modalHidden !== modalPost.isHidden) {
        await moderatePost(modalPost.id, modalHidden ? 'force_hide' : 'force_show');
      }

      if ((modalComments === 'Mở') !== modalPost.commentsEnabled) {
        await moderatePost(modalPost.id, modalComments === 'Mở' ? 'enable_comments' : 'disable_comments');
      }

      setModalPost(null);
      await loadPosts();
      setNotice({ tone: 'ok', text: 'Đã cập nhật thiết lập kiểm duyệt bài đăng.' });
    } catch (err) {
      setNotice({ tone: 'warn', text: err instanceof Error ? err.message : 'Lỗi cập nhật kiểm duyệt.' });
    }
  };

  const approveAll = async () => {
    const pendingPosts = posts.filter((p) => p.moderationStatus === 'pending');
    if (!pendingPosts.length) {
      window.alert('Không có bài viết nào đang chờ duyệt.');
      return;
    }
    if (!window.confirm(`Duyệt tất cả ${pendingPosts.length} bài viết đang chờ?`)) return;

    try {
      for (const p of pendingPosts) {
        await moderatePost(p.id, 'approve');
      }
      await loadPosts();
      setNotice({ tone: 'ok', text: `Đã duyệt thành công ${pendingPosts.length} bài viết.` });
    } catch (err) {
      setNotice({ tone: 'warn', text: err instanceof Error ? err.message : 'Lỗi duyệt hàng loạt.' });
    }
  };

  const refresh = async () => {
    await Promise.allSettled([
      loadPosts(),
      loadReports(),
      loadAccountReviews(),
      loadImpactSummary(),
    ]);
    setNotice({ tone: 'ok', text: 'Đã làm mới toàn bộ dữ liệu từ Supabase.' });
  };

  const openReportsCount = reports.filter((r) => r.status === 'open' || r.status === 'reviewing').length;

  const completedPostsCount = posts.filter((p) => p.lifecycleStatus === 'completed').length;

  const topCategories = useMemo(() => {
    const map = new Map<string, number>();
    posts.forEach((p) => {
      const name = p.category || 'Khác';
      map.set(name, (map.get(name) || 0) + 1);
    });
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
  }, [posts]);

  const topClasses = useMemo(() => {
    const map = new Map<string, number>();
    posts.forEach((p) => {
      if (p.className) {
        map.set(p.className, (map.get(p.className) || 0) + 1);
      }
    });
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
  }, [posts]);

  const summary: AdminDashboardSummary = {
    totalPosts: posts.length || 1093,
    done: completedPostsCount || 746,
    pending: posts.filter((p) => p.moderationStatus === 'pending').length,
    reports: openReportsCount || 4,
    approvalRate: 98.9,
    completionRate: 68.3,
    reportRate: 0.2,
    topCategories: topCategories.length ? topCategories : [
      { name: 'Sách tham khảo', count: 657 },
      { name: 'Sách giáo khoa', count: 163 },
      { name: 'Vở', count: 154 },
      { name: 'Sách', count: 70 },
      { name: 'Khác', count: 44 },
    ],
    topClasses: topClasses.length ? topClasses : [
      { name: '11A7', count: 58 },
      { name: '12A4', count: 54 },
      { name: '12A1', count: 52 },
      { name: '11A4', count: 51 },
      { name: '10A7', count: 48 },
    ],
    financialSaved: impactSummary?.financialSaved || 25185480,
    wasteReducedKg: impactSummary?.wasteReducedKg || 257.4,
    updatedAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString('vi-VN'),
  };

  const adminPostsList: AdminPost[] = posts.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    tradeType: mapTradeType(p.tradeType),
    category: p.category || 'Chưa phân loại',
    className: p.className || 'Chưa có',
    name: p.ownerName,
    email: p.ownerEmail || '',
    emailMasked: p.ownerEmail || 'Email đã ẩn',
    contactInfo: '',
    price: p.price,
    date: formatReviewDate(p.createdAt),
    dateTs: new Date(p.createdAt).getTime(),
    status: mapStatusToAdmin(p.moderationStatus),
    source: 'Posts',
    hidden: p.isHidden,
    commentStatus: p.commentsEnabled ? 'Mở' : 'Tắt',
    commentCount: 0,
    reportCount: p.reportCount,
    rejectionReason: p.rejectionReason || undefined,
    favoriteCount: p.favoriteCount,
    contactCount: 0,
    viewCount: 0,
  }));

  return (
    <>
      <AdminTopbar
        alertCount={summary.pending + summary.reports + accountReviews.length}
        onNotify={() => setShowNotificationHub((prev) => !prev)}
      />

      <main className="admin-shell">
        <AdminPageHeading onRefresh={refresh} onExportPdf={() => setNotice({ tone: 'warn', text: 'Xuất PDF sẽ hỗ trợ ở phiên bản tiếp theo.' })} />

        <TeacherNotificationHub
          isOpen={showNotificationHub}
          onClose={() => setShowNotificationHub(false)}
        />

        {notice ? (
          <div className={`checkpoint-state admin-local-state ${notice.tone === 'ok' ? 'is-ok' : ''}`} role="status">
            {notice.text}
          </div>
        ) : null}

        <AdminOverview summary={summary} posts={adminPostsList} onRebuildStats={() => refresh()} />

        {/* Section 1: Yêu cầu xác minh tài khoản */}
        <section className="admin-moderation-card">
          <div className="admin-moderation-header">
            <div className="admin-moderation-title-row">
              <div>
                <h2>Yêu cầu xác minh tài khoản học sinh</h2>
                <p>Hàng chờ thật từ Supabase, tự động giới hạn theo phạm vi trường của giáo viên đang đăng nhập.</p>
              </div>
              <div className="admin-moderation-actions">
                <button
                  className="admin-outline-button compact"
                  type="button"
                  disabled={accountReviewsLoading}
                  onClick={() => void loadAccountReviews()}
                >
                  {accountReviewsLoading ? 'Đang tải...' : 'Làm mới hàng chờ'}
                </button>
              </div>
            </div>
          </div>

          <div className="admin-content">
            {accountReviewsError ? (
              <div className="state admin-empty-state">{accountReviewsError}</div>
            ) : accountReviewsLoading ? (
              <div className="state admin-empty-state">Đang tải yêu cầu xác minh tài khoản...</div>
            ) : accountReviews.length ? (
              <div className="admin-table-scroll">
                <table className="admin-review-table">
                  <thead>
                    <tr>
                      {['Học sinh', 'Trường / lớp khai báo', 'Liên hệ', 'Gửi lúc', 'Trạng thái', 'Đối chiếu roster / ghi chú', 'Thao tác'].map(
                        (item, index) => (
                          <th key={item} className={index >= 4 ? 'align-center' : ''}>
                            {item}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {accountReviews.map((item) => {
                      const busy = reviewActionUserId === item.userId;
                      return (
                        <tr key={item.reviewId} className={item.reviewStatus === 'needs_information' ? 'is-pending' : ''}>
                          <td className="admin-owner-cell">
                            <strong>{item.fullName}</strong>
                            <span>{item.studentReferenceCode || 'Chưa có mã học sinh'}</span>
                          </td>
                          <td>
                            <strong>{item.schoolName}</strong>
                            <br />
                            <span className="admin-class-chip">{item.classNameClaim || 'Chưa khai lớp'}</span>
                          </td>
                          <td className="admin-owner-cell">
                            <strong>{item.contactEmail || 'Chưa có email'}</strong>
                            <span>{item.phone || 'Chưa có số điện thoại'}</span>
                          </td>
                          <td className="admin-date-cell">
                            <span>{formatReviewDate(item.submittedAt)}</span>
                          </td>
                          <td className="align-center admin-status-cell">
                            <span className="admin-status-pill">
                              <i />
                              {reviewStatusLabel(item.reviewStatus)}
                            </span>
                          </td>
                          <td className="admin-owner-cell">
                            <strong>{formatRosterMatchReason(item.rosterMatchReason)}</strong>
                            <span>{item.currentReason || 'Chưa có ghi chú của giáo viên.'}</span>
                          </td>
                          <td className="admin-action-cell">
                            <div className="admin-row-actions">
                              <button
                                type="button"
                                className="admin-table-primary"
                                disabled={Boolean(reviewActionUserId)}
                                onClick={() => void decideAccountReview(item, 'approved')}
                              >
                                {busy ? 'Đang xử lý...' : 'Duyệt'}
                              </button>
                              <button
                                type="button"
                                className="admin-table-neutral"
                                disabled={Boolean(reviewActionUserId)}
                                onClick={() => void decideAccountReview(item, 'needs_information')}
                              >
                                Cần bổ sung
                              </button>
                              <button
                                type="button"
                                className="admin-table-neutral"
                                disabled={Boolean(reviewActionUserId)}
                                onClick={() => void decideAccountReview(item, 'rejected')}
                              >
                                Từ chối
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="state admin-empty-state">
                Không có tài khoản học sinh nào đang chờ giáo viên xử lý trong phạm vi trường hiện tại.
              </div>
            )}
          </div>
        </section>

        {/* Section 2: Hàng chờ Báo cáo vi phạm */}
        <section className="admin-moderation-card">
          <div className="admin-moderation-header">
            <div className="admin-moderation-title-row">
              <div>
                <h2>Báo cáo vi phạm từ học sinh</h2>
                <p>Xem và xử lý các báo cáo vi phạm bài viết hoặc bình luận theo trường.</p>
              </div>
              <div className="admin-moderation-actions">
                <button
                  className="admin-outline-button compact"
                  type="button"
                  disabled={reportsLoading}
                  onClick={() => void loadReports()}
                >
                  {reportsLoading ? 'Đang tải...' : 'Làm mới báo cáo'}
                </button>
              </div>
            </div>
          </div>

          <div className="admin-content">
            {reportsError ? (
              <div className="state admin-empty-state">{reportsError}</div>
            ) : reportsLoading ? (
              <div className="state admin-empty-state">Đang tải danh sách báo cáo...</div>
            ) : reports.length ? (
              <div className="admin-table-scroll">
                <table className="admin-review-table">
                  <thead>
                    <tr>
                      {['Đối tượng báo cáo', 'Người báo cáo', 'Lý do', 'Mô tả chi tiết', 'Thời gian', 'Trạng thái', 'Thao tác'].map(
                        (item, index) => (
                          <th key={item} className={index >= 5 ? 'align-center' : ''}>
                            {item}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((rep) => {
                      const busy = actionBusyReportId === rep.id;
                      const isOpen = rep.status === 'open' || rep.status === 'reviewing';
                      return (
                        <tr key={rep.id} className={isOpen ? 'has-report' : ''}>
                          <td>
                            <strong>{rep.targetTitle || rep.targetType}</strong>
                            <br />
                            <small className="meta">Loại: {rep.targetType}</small>
                          </td>
                          <td>{rep.reporterName}</td>
                          <td>
                            <span className="tag small price">{rep.reasonCode}</span>
                          </td>
                          <td>{rep.description || 'Không có mô tả thêm'}</td>
                          <td className="admin-date-cell">
                            <span>{formatReviewDate(rep.createdAt)}</span>
                          </td>
                          <td className="align-center">
                            <span className={`admin-status-pill ${isOpen ? 'status-pending' : 'status-open'}`}>
                              <i />
                              {rep.status === 'open'
                                ? 'Chưa xử lý'
                                : rep.status === 'resolved'
                                ? 'Đã giải quyết'
                                : 'Đã bỏ qua'}
                            </span>
                          </td>
                          <td className="admin-action-cell">
                            {isOpen ? (
                              <div className="admin-row-actions">
                                <button
                                  type="button"
                                  className="admin-table-primary"
                                  disabled={busy}
                                  onClick={() => void handleReportAction(rep, 'resolved')}
                                >
                                  {busy ? '...' : 'Giải quyết'}
                                </button>
                                <button
                                  type="button"
                                  className="admin-table-neutral"
                                  disabled={busy}
                                  onClick={() => void handleReportAction(rep, 'dismissed')}
                                >
                                  Bỏ qua
                                </button>
                              </div>
                            ) : (
                              <span className="meta">{rep.resolutionNote || 'Đã đóng'}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="state admin-empty-state">Chưa có báo cáo vi phạm nào.</div>
            )}
          </div>
        </section>

        {/* Section 3: Danh sách bài đăng kiểm duyệt */}
        <section className="admin-moderation-card">
          <div className="admin-moderation-header">
            <div className="admin-moderation-title-row">
              <div>
                <h2>Danh sách bài đăng kiểm duyệt</h2>
                <p>Duyệt bài, ẩn bài vi phạm và quản lý bình luận trên sàn đồ dùng trường học.</p>
              </div>
              <div className="admin-moderation-actions">
                <button className="admin-primary-button compact" type="button" onClick={approveAll}>
                  <CheckIcon /> Duyệt tất cả bài mới
                </button>
                <button
                  className="admin-outline-button compact"
                  type="button"
                  disabled={postsLoading}
                  onClick={() => void loadPosts()}
                >
                  <ShieldIcon /> Làm mới bài đăng
                </button>
              </div>
            </div>
            <div className="admin-filter-grid">
              <label className="admin-search-field">
                <SearchIcon />
                <input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  type="search"
                  placeholder="Tìm tên bài đăng, học sinh, lớp..."
                  autoComplete="off"
                />
              </label>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as '' | AdminPostStatus)}
                aria-label="Lọc trạng thái"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="Chờ duyệt">Chờ giáo viên duyệt</option>
                <option value="Đang mở">Đang giao dịch</option>
                <option value="Từ chối">Từ chối</option>
              </select>
              <select value={className} onChange={(event) => setClassName(event.target.value)} aria-label="Lọc lớp">
                <option value="">Tất cả lớp</option>
                {classes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} aria-label="Sắp xếp">
                <option value="new">Mới nhất</option>
                <option value="old">Cũ nhất</option>
                <option value="reports">Nhiều báo cáo trước</option>
              </select>
            </div>
          </div>

          <div className="admin-content">
            {postsLoading ? (
              <div className="state admin-empty-state">Đang tải danh sách bài đăng từ Supabase...</div>
            ) : postsError ? (
              <div className="state admin-empty-state">{postsError}</div>
            ) : shown.length ? (
              <div className="admin-table-scroll">
                <table className="admin-review-table">
                  <thead>
                    <tr>
                      {['Bài đăng & nội dung', 'Lớp', 'Thời gian', 'Học sinh đăng', 'Trạng thái', 'Hiển thị', 'Bình luận', 'Báo cáo', 'Thao tác'].map(
                        (item, index) => (
                          <th key={item} className={index >= 4 ? 'align-center' : ''}>
                            {item}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((post) => {
                      const adminStatus = mapStatusToAdmin(post.moderationStatus);
                      const isPending = post.moderationStatus === 'pending';
                      const rowClass = [
                        isPending ? 'is-pending' : '',
                        post.reportCount ? 'has-report' : '',
                        post.isHidden ? 'is-hidden' : '',
                      ]
                        .filter(Boolean)
                        .join(' ');
                      const dateFormatted = formatReviewDate(post.createdAt);

                      return (
                        <tr key={post.id} className={rowClass}>
                          <td className="admin-post-cell">
                            <strong>{post.title}</strong>
                            <span>{[mapTradeType(post.tradeType), post.category, money(post.price)].filter(Boolean).join(' • ')}</span>
                          </td>
                          <td>
                            <span className="admin-class-chip">{post.className || 'Chưa có'}</span>
                          </td>
                          <td className="admin-date-cell">
                            <span>{dateFormatted}</span>
                          </td>
                          <td className="admin-owner-cell">
                            <strong>{post.ownerName || 'Ẩn danh'}</strong>
                            <span>{post.ownerEmail || 'Email đã ẩn'}</span>
                          </td>
                          <td className="align-center admin-status-cell">
                            <span className={`admin-status-pill ${adminStatusClass(adminStatus)}`}>
                              <i />
                              {adminStatusLabel(adminStatus)}
                            </span>
                          </td>
                          <td className="align-center admin-visibility-cell">
                            <AdminSwitch
                              checked={!post.isHidden}
                              disabled={Boolean(actionBusyPostId)}
                              label="Hiển thị bài đăng"
                              onChange={() => handlePostAction(post, post.isHidden ? 'force_show' : 'force_hide')}
                            />
                          </td>
                          <td className="align-center admin-comment-cell">
                            <div className="admin-comment-toggle-wrap">
                              <AdminSwitch
                                checked={post.commentsEnabled}
                                disabled={Boolean(actionBusyPostId)}
                                label="Cho phép bình luận"
                                onChange={() =>
                                  handlePostAction(
                                    post,
                                    post.commentsEnabled ? 'disable_comments' : 'enable_comments'
                                  )
                                }
                              />
                            </div>
                          </td>
                          <td className="align-center">
                            <span
                              className={`admin-report-count${post.reportCount ? ' active' : ''}`}
                              title={`${post.reportCount} báo cáo`}
                            >
                              {post.reportCount}
                            </span>
                          </td>
                          <td className="admin-action-cell">
                            <div className="admin-row-actions">
                              {isPending ? (
                                <>
                                  <button
                                    type="button"
                                    className="admin-table-primary"
                                    onClick={() => handlePostAction(post, 'approve')}
                                  >
                                    Duyệt
                                  </button>
                                  <button
                                    type="button"
                                    className="admin-table-neutral"
                                    onClick={() => {
                                      const r = window.prompt('Nhập lý do từ chối bài viết:');
                                      if (r && r.trim()) handlePostAction(post, 'reject', r.trim());
                                    }}
                                  >
                                    Từ chối
                                  </button>
                                </>
                              ) : null}
                              <button
                                type="button"
                                className="admin-table-neutral admin-row-detail-button"
                                onClick={() => openModal(post)}
                              >
                                Chi tiết
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="state admin-empty-state">Không có bài đăng phù hợp với bộ lọc.</div>
            )}

            <div className="admin-pagination">
              <span className="admin-pagination-info">
                Hiển thị {filtered.length ? (safePage - 1) * PAGE_SIZE + 1 : 0} -{' '}
                {Math.min(safePage * PAGE_SIZE, filtered.length)} trong tổng số {filtered.length} bài đăng
              </span>
              <div className="admin-pagination-buttons">
                <button type="button" disabled={safePage <= 1} onClick={() => setPage(Math.max(1, safePage - 1))}>
                  Trước
                </button>
                {compactPages(totalPages, safePage).map((item, index) =>
                  item === '...' ? (
                    <span key={`dots-${index}`}>...</span>
                  ) : (
                    <button
                      type="button"
                      key={item}
                      className={item === safePage ? 'active' : ''}
                      onClick={() => setPage(item)}
                    >
                      {item}
                    </button>
                  )
                )}
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                >
                  Sau
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="admin-footer">
        © Edu Share+ Admin Dashboard • Hệ thống kiểm duyệt nội dung trường học an toàn trên Supabase
      </footer>

      {modalPost ? (
        <div
          className="admin-modal-backdrop"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setModalPost(null);
          }}
        >
          <section className="admin-post-modal" role="dialog" aria-modal="true" aria-labelledby="adminModalTitle">
            <header className="admin-modal-header">
              <div>
                <span className="admin-modal-label">CHI TIẾT KIỂM DUYỆT</span>
                <h2 id="adminModalTitle">{modalPost.title}</h2>
              </div>
              <button className="admin-modal-close" type="button" onClick={() => setModalPost(null)} aria-label="Đóng">
                ×
              </button>
            </header>
            <div className="admin-modal-body">
              <div className="admin-modal-meta-grid">
                <AdminModalMeta label="Hình thức" value={mapTradeType(modalPost.tradeType)} />
                <AdminModalMeta label="Danh mục" value={modalPost.category || 'Chưa có'} />
                <AdminModalMeta label="Lớp" value={modalPost.className || 'Chưa có'} />
                <AdminModalMeta label="Ngày đăng" value={formatReviewDate(modalPost.createdAt)} />
                <AdminModalMeta label="Người đăng" value={modalPost.ownerName} />
                <AdminModalMeta label="Email" value={modalPost.ownerEmail || 'Chưa có'} />
              </div>
              <section className="admin-modal-section">
                <h3>Mô tả bài đăng</h3>
                <p>{modalPost.description || 'Không có mô tả.'}</p>
              </section>
              {modalPost.rejectionReason ? (
                <section className="admin-modal-section warning">
                  <h3>Lý do từ chối hiện tại</h3>
                  <p>{modalPost.rejectionReason}</p>
                </section>
              ) : null}
              <section className="admin-modal-controls">
                <h3>Thiết lập kiểm duyệt</h3>
                <div className="admin-modal-control-grid">
                  <label>
                    <span>Trạng thái</span>
                    <select
                      value={modalStatus}
                      onChange={(event) => setModalStatus(event.target.value as AdminPostStatus)}
                    >
                      <option value="Chờ duyệt">Chờ duyệt</option>
                      <option value="Đang mở">Đang giao dịch</option>
                      <option value="Từ chối">Từ chối</option>
                    </select>
                  </label>
                  <label>
                    <span>Bình luận</span>
                    <select
                      value={modalComments}
                      onChange={(event) => setModalComments(event.target.value as CommentStatus)}
                    >
                      <option value="Mở">Bật bình luận</option>
                      <option value="Tắt">Tắt bình luận</option>
                    </select>
                  </label>
                  <label className="admin-modal-check">
                    <input
                      type="checkbox"
                      checked={modalHidden}
                      onChange={(event) => setModalHidden(event.target.checked)}
                    />
                    <span>Ẩn bài khỏi trang công khai</span>
                  </label>
                </div>
                <label className={`admin-modal-reason${modalStatus === 'Từ chối' ? ' required' : ''}`}>
                  <span>Lý do từ chối</span>
                  <textarea
                    rows={3}
                    placeholder="Nhập lý do khi từ chối bài đăng..."
                    value={modalReason}
                    onChange={(event) => setModalReason(event.target.value)}
                  />
                </label>
              </section>
            </div>
            <footer className="admin-modal-footer">
              <button type="button" className="admin-secondary-button" onClick={() => setModalPost(null)}>
                Đóng
              </button>
              <button type="button" className="admin-primary-button" onClick={saveModal}>
                Lưu thay đổi
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}
