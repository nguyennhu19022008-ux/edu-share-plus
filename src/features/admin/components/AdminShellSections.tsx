import { useState } from 'react';
import { navigateLegacy } from '../../../app/legacyRouter';
import { signOutStaff } from '../../auth/staff/staffAuthService';
import type { AdminDashboardSummary, AdminPost } from '../types';
import {
  AdminCharts,
  AdminRankColumn,
  AdminRate,
  AdminSummaryCard,
  BellIcon,
  DocumentIcon,
  LogoutIcon,
  RefreshIcon,
  ShieldIcon,
} from './AdminVisuals';
import RosterManagementPanel from './RosterManagementPanel';

function money(value:number):string {
  if (!value) return '';
  return new Intl.NumberFormat('vi-VN').format(value) + 'đ';
}

export function AdminTopbar({ alertCount, onNotify }:{ alertCount:number; onNotify:()=>void }) {
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      await signOutStaff();
      navigateLegacy('landing');
    } catch (error) {
      window.alert(
        error instanceof Error
          ? `Không thể đăng xuất: ${error.message}`
          : 'Không thể đăng xuất phiên giáo viên lúc này.',
      );
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <header className="admin-topbar">
      <div className="admin-topbar-inner">
        <button className="admin-brand-button" type="button" onClick={() => navigateLegacy('admin')} aria-label="Trang quản trị Edu Share+">
          <span className="admin-brand-mark" aria-hidden="true"><ShieldIcon /></span>
          <span className="admin-brand-copy">
            <span className="admin-brand-title">Edu Share<span>+</span> <em>Admin Panel</em></span>
            <small>Hệ thống quản trị, duyệt bài và báo cáo tác động xanh</small>
          </span>
        </button>
        <div className="admin-account-actions">
          <button className="admin-icon-button notify-btn" type="button" onClick={onNotify} title="Thông báo" aria-label="Mở thông báo">
            <BellIcon /><span className="notify-badge">{alertCount || ''}</span>
          </button>
          <div className="admin-user-block">
            <span className="admin-user-avatar avatar">GV</span>
            <span className="admin-user-copy"><strong>Xin chào, Giáo viên</strong><small><i></i><span>Đang hoạt động</span></small></span>
          </div>
          <button
            className="admin-logout-button"
            type="button"
            disabled={loggingOut}
            onClick={() => void handleLogout()}
          >
            <LogoutIcon />
            <span>{loggingOut ? 'Đang thoát...' : 'Thoát'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}

export function AdminPageHeading({ onRefresh, onExportPdf }:{ onRefresh:()=>void; onExportPdf:()=>void }) {
  return (
    <section className="admin-page-heading">
      <div><h1>Quản trị Edu Share+</h1><p>Duyệt bài, quản lý hiển thị, bình luận và theo dõi tác động của hệ thống.</p></div>
      <div className="admin-page-actions">
        <button className="admin-secondary-button" type="button" onClick={onRefresh}><RefreshIcon />Làm mới dữ liệu</button>
        <button className="admin-primary-button" type="button" onClick={onExportPdf}><DocumentIcon />Xuất báo cáo PDF</button>
      </div>
    </section>
  );
}

export function AdminOverview({ summary, posts, onRebuildStats }:{ summary:AdminDashboardSummary; posts:AdminPost[]; onRebuildStats:()=>void }) {
  return (
    <>
      <section className="admin-summary-grid" aria-label="Tổng quan quản trị">
        <AdminSummaryCard label="Tổng bài đăng" value={summary.totalPosts} note="Toàn bộ bài trong hệ thống" tone="blue" icon="▤" />
        <AdminSummaryCard label="Đã hoàn thành" value={summary.done} note="Giao dịch đã hoàn tất" tone="green" icon="✓" />
        <AdminSummaryCard label="Chờ duyệt" value={summary.pending} note={summary.pending ? 'Cần xử lý' : 'Không có bài chờ'} tone="amber" icon="◷" />
        <AdminSummaryCard label="Báo cáo" value={summary.reports} note={summary.reports ? 'Cần kiểm tra' : 'Không có báo cáo mới'} tone="red" icon="!" />
        <AdminSummaryCard label="Tiết kiệm học sinh" value={money(summary.financialSaved) || '0đ'} note="Chi phí tái sử dụng ước tính" tone="mint" icon="₫" />
        <AdminSummaryCard label="Giảm rác thải" value={`${summary.wasteReducedKg} kg`} note="Tác động từ giao dịch hoàn tất" tone="cyan" icon="↗" />
      </section>
      <section className="admin-insights-grid">
        <article className="admin-insight-card admin-rate-card">
          <div className="admin-card-heading"><h2>Thống kê nâng cao</h2><span className="admin-live-chip">Realtime</span></div>
          <div className="admin-rate-list">
            <AdminRate label="Tỷ lệ duyệt / đăng bài" value={summary.approvalRate} tone="green" />
            <AdminRate label="Tỷ lệ hoàn thành trao đổi" value={summary.completionRate} tone="blue" />
            <AdminRate label="Tỷ lệ bài bị báo cáo" value={summary.reportRate} tone="red" />
          </div>
          <div className="admin-rate-footer"><span>Cập nhật: {summary.updatedAt}</span><button type="button" onClick={onRebuildStats}>Đồng bộ thống kê</button></div>
        </article>
        <article className="admin-insight-card admin-rank-card">
          <div className="admin-card-heading"><h2>Top danh mục & lớp học tích cực</h2><span className="admin-card-note">LOCAL_UI_SAMPLE</span></div>
          <div className="admin-rank-grid">
            <AdminRankColumn title="Danh mục nhiều nhất" items={summary.topCategories} />
            <AdminRankColumn title="Top lớp sôi nổi" items={summary.topClasses} isClass />
          </div>
        </article>
      </section>
      <AdminCharts posts={posts} />
      <RosterManagementPanel />
    </>
  );
}
