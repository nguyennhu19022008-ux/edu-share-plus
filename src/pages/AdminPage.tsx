import { useEffect, useMemo, useState } from 'react';
import { navigateLegacy } from '../app/legacyRouter';
import {
  approveAllPendingLocal,
  getAdminDashboardSummaryLocal,
  getAdminPostLocal,
  getAdminPostsLocal,
  resetAdminPostsLocal,
  updateAdminPostLocal,
} from '../features/admin/localAdminStore';
import type { AdminPost, AdminPostStatus, CommentStatus } from '../features/admin/types';

const PAGE_SIZE = 6;
const STATUS_OPTIONS:AdminPostStatus[] = ['Chờ duyệt','Đang mở','Từ chối'];

type SortMode = 'new' | 'old' | 'reports';
type Draft = { status:AdminPostStatus; visible:boolean; comments:boolean };
type Notice = { tone:'ok'|'warn'; text:string } | null;

function money(value:number):string {
  if (!value) return '';
  return new Intl.NumberFormat('vi-VN').format(value) + 'đ';
}

function statusLabel(value:AdminPostStatus):string {
  if (value === 'Đang mở') return 'Đang giao dịch';
  if (value === 'Đã xong') return 'Đã hoàn tất';
  return value;
}

function statusClass(value:AdminPostStatus):string {
  const map:Record<AdminPostStatus,string> = {
    'Đang mở':'open', 'Chờ duyệt':'pending', 'Đã xong':'done', 'Từ chối':'rejected', 'Đã thu hồi':'withdrawn',
  };
  return map[value];
}

function buildDrafts(items:AdminPost[]):Record<string,Draft> {
  return Object.fromEntries(items.map((post) => [post.id, {
    status:post.status,
    visible:!post.hidden,
    comments:post.commentStatus !== 'Tắt',
  }]));
}

function normalize(value:string):string {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
}

function compactPages(totalPages:number, active:number):(number|'...')[] {
  if (totalPages <= 5) return Array.from({length:totalPages},(_,index)=>index+1);
  const pages:(number|'...')[] = [1];
  const start = Math.max(2, active - 1);
  const end = Math.min(totalPages - 1, active + 1);
  if (start > 2) pages.push('...');
  for (let page=start; page<=end; page+=1) pages.push(page);
  if (end < totalPages - 1) pages.push('...');
  pages.push(totalPages);
  return pages;
}

export default function AdminPage() {
  const [posts, setPosts] = useState<AdminPost[]>(() => getAdminPostsLocal());
  const [drafts, setDrafts] = useState<Record<string,Draft>>(() => buildDrafts(getAdminPostsLocal()));
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<''|AdminPostStatus>('');
  const [className, setClassName] = useState('');
  const [sort, setSort] = useState<SortMode>('new');
  const [page, setPage] = useState(1);
  const [modalPost, setModalPost] = useState<AdminPost|null>(null);
  const [modalStatus, setModalStatus] = useState<AdminPostStatus>('Đang mở');
  const [modalHidden, setModalHidden] = useState(false);
  const [modalComments, setModalComments] = useState<CommentStatus>('Mở');
  const [modalReason, setModalReason] = useState('');
  const [notice, setNotice] = useState<Notice>({ tone:'warn', text:'Checkpoint 1H dùng LOCAL_UI_SAMPLE để kiểm thử dashboard. Các số dưới đây không phải số liệu nghiên cứu hoặc dữ liệu production.' });

  useEffect(() => {
    document.body.className = 'ecommerce-body admin-redesign-body';
    return () => { document.body.className = ''; };
  }, []);

  useEffect(() => { setPage(1); }, [keyword,status,className,sort]);

  useEffect(() => {
    if (!modalPost) return;
    document.body.classList.add('admin-modal-open');
    const close = (event:KeyboardEvent) => { if (event.key === 'Escape') setModalPost(null); };
    document.addEventListener('keydown', close);
    return () => {
      document.body.classList.remove('admin-modal-open');
      document.removeEventListener('keydown', close);
    };
  }, [modalPost]);

  const summary = useMemo(() => getAdminDashboardSummaryLocal(), [posts]);
  const classes = useMemo(() => [...new Set(posts.map((post)=>post.className).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi')), [posts]);

  const filtered = useMemo(() => {
    const kw = normalize(keyword);
    const list = posts.filter((post) => {
      if (status && post.status !== status) return false;
      if (className && post.className !== className) return false;
      if (!kw) return true;
      return normalize([post.title, post.name, post.className, post.category, post.tradeType].join(' ')).includes(kw);
    });
    return [...list].sort((a,b) => {
      if (sort === 'old') return a.dateTs - b.dateTs;
      if (sort === 'reports') return b.reportCount - a.reportCount || b.dateTs - a.dateTs;
      return b.dateTs - a.dateTs;
    });
  }, [posts,keyword,status,className,sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page,totalPages);
  const shown = filtered.slice((safePage-1)*PAGE_SIZE, safePage*PAGE_SIZE);

  const syncPosts = (message?:string) => {
    const next = getAdminPostsLocal();
    setPosts(next);
    setDrafts(buildDrafts(next));
    if (message) setNotice({ tone:'ok', text:message });
  };

  const setDraft = (id:string, patch:Partial<Draft>) => {
    setDrafts((value) => ({ ...value, [id]:{ ...(value[id] || {status:'Đang mở',visible:true,comments:true}), ...patch } }));
  };

  const saveRow = (post:AdminPost) => {
    if (post.source === 'Archive') return;
    const draft = drafts[post.id] || { status:post.status, visible:!post.hidden, comments:post.commentStatus !== 'Tắt' };
    let rejectionReason = post.rejectionReason || '';
    if (draft.status === 'Từ chối') {
      rejectionReason = String(window.prompt('Nhập lý do từ chối để học sinh biết cần chỉnh sửa gì:', rejectionReason) || '').trim();
      if (!rejectionReason) {
        window.alert('Vui lòng nhập lý do từ chối.');
        return;
      }
    } else rejectionReason = '';

    updateAdminPostLocal(post.id, {
      status:draft.status,
      hidden:!draft.visible,
      commentStatus:draft.comments ? 'Mở' : 'Tắt',
      rejectionReason,
    });
    syncPosts(`Đã lưu thay đổi kiểm duyệt cho “${post.title}” trong phiên local.`);
  };

  const openModal = (post:AdminPost) => {
    const latest = getAdminPostLocal(post.id) || post;
    setModalPost(latest);
    setModalStatus(latest.status);
    setModalHidden(latest.hidden);
    setModalComments(latest.commentStatus);
    setModalReason(latest.rejectionReason || '');
  };

  const saveModal = () => {
    if (!modalPost || modalPost.source === 'Archive') return;
    if (modalStatus === 'Từ chối' && !modalReason.trim()) {
      window.alert('Vui lòng nhập lý do từ chối để học sinh biết cần chỉnh sửa gì.');
      return;
    }
    updateAdminPostLocal(modalPost.id, {
      status:modalStatus,
      hidden:modalHidden,
      commentStatus:modalComments,
      rejectionReason:modalStatus === 'Từ chối' ? modalReason.trim() : '',
    });
    setModalPost(null);
    syncPosts('Đã cập nhật bài đăng từ cửa sổ chi tiết kiểm duyệt.');
  };

  const approveAll = () => {
    if (!window.confirm('Duyệt tất cả bài đang chờ giáo viên duyệt?')) return;
    const count = approveAllPendingLocal();
    syncPosts(`Đã duyệt ${count} bài đang chờ trong phiên local.`);
  };

  const refresh = () => {
    setPosts(getAdminPostsLocal());
    setDrafts(buildDrafts(getAdminPostsLocal()));
    setNotice({ tone:'ok', text:'Đã làm mới dashboard từ local in-memory store. Chưa có request backend.' });
  };

  const rebuildStats = () => {
    if (!window.confirm('Đồng bộ lại cache và thống kê quản trị local?')) return;
    setPosts([...getAdminPostsLocal()]);
    setNotice({ tone:'ok', text:'Đã tính lại thống kê từ LOCAL_UI_SAMPLE. Không có dữ liệu nghiên cứu nào bị thay đổi.' });
  };

  const resetLocal = () => {
    if (!window.confirm('Khôi phục toàn bộ dữ liệu kiểm thử 1H về trạng thái ban đầu?')) return;
    const next = resetAdminPostsLocal();
    setPosts(next);
    setDrafts(buildDrafts(next));
    setKeyword(''); setStatus(''); setClassName(''); setSort('new'); setPage(1);
    setNotice({ tone:'ok', text:'Đã khôi phục LOCAL_UI_SAMPLE của Checkpoint 1H.' });
  };

  const showSystemHealth = () => {
    const current = getAdminPostsLocal();
    const message = [
      'Trạng thái: local-ui-ready',
      'Phiên bản: Phase 1 / Checkpoint 1H',
      'Backend: chưa kết nối',
      `Bài kiểm thử: ${current.length}`,
      `Bình luận mẫu: ${current.reduce((sum,p)=>sum+p.commentCount,0)}`,
      `Báo cáo mẫu: ${current.reduce((sum,p)=>sum+p.reportCount,0)}`,
      'Cảnh báo: dữ liệu hiện tại chỉ dùng kiểm thử giao diện',
    ].join('\n');
    window.alert(message);
  };

  const exportPdf = () => {
    setNotice({ tone:'warn', text:'Xuất PDF chưa được kết nối ở Phase 1. Nút được giữ đúng vị trí/flow cũ nhưng không tạo báo cáo giả.' });
  };

  return (
    <>
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
            <button className="admin-icon-button notify-btn" type="button" onClick={() => setNotice({tone:'ok',text:'Không có thông báo backend ở Phase 1. Badge chỉ là trạng thái UI local.'})} title="Thông báo" aria-label="Mở thông báo">
              <BellIcon />
              <span className="notify-badge">{summary.pending + summary.reports || ''}</span>
            </button>
            <div className="admin-user-block">
              <span className="admin-user-avatar avatar">GV</span>
              <span className="admin-user-copy"><strong>Xin chào, Giáo viên</strong><small><i></i><span>Đang hoạt động</span></small></span>
            </div>
            <button className="admin-logout-button" type="button" onClick={() => navigateLegacy('landing')}><LogoutIcon /><span>Thoát</span></button>
          </div>
        </div>
      </header>

      <main className="admin-shell">
        <section className="admin-page-heading">
          <div><h1>Quản trị Edu Share+</h1><p>Duyệt bài, quản lý hiển thị, bình luận và theo dõi tác động của hệ thống.</p></div>
          <div className="admin-page-actions">
            <button className="admin-secondary-button" type="button" onClick={refresh}><RefreshIcon />Làm mới dữ liệu</button>
            <button className="admin-primary-button" type="button" onClick={exportPdf}><DocumentIcon />Xuất báo cáo PDF</button>
          </div>
        </section>

        {notice ? <div className={`checkpoint-state admin-local-state ${notice.tone === 'ok' ? 'is-ok' : ''}`} role="status">{notice.text}</div> : null}

        <section className="admin-summary-grid" aria-label="Tổng quan quản trị">
          <SummaryCard label="Tổng bài đăng" value={summary.totalPosts} note="Toàn bộ bài trong hệ thống" tone="blue" icon="▤" />
          <SummaryCard label="Đã hoàn thành" value={summary.done} note="Giao dịch đã hoàn tất" tone="green" icon="✓" />
          <SummaryCard label="Chờ duyệt" value={summary.pending} note={summary.pending ? 'Cần xử lý' : 'Không có bài chờ'} tone="amber" icon="◷" />
          <SummaryCard label="Báo cáo" value={summary.reports} note={summary.reports ? 'Cần kiểm tra' : 'Không có báo cáo mới'} tone="red" icon="!" />
          <SummaryCard label="Tiết kiệm học sinh" value={money(summary.financialSaved) || '0đ'} note="Chi phí tái sử dụng ước tính" tone="mint" icon="₫" />
          <SummaryCard label="Giảm rác thải" value={`${summary.wasteReducedKg} kg`} note="Tác động từ giao dịch hoàn tất" tone="cyan" icon="↗" />
        </section>

        <section className="admin-insights-grid">
          <article className="admin-insight-card admin-rate-card">
            <div className="admin-card-heading"><h2>Thống kê nâng cao</h2><span className="admin-live-chip">Realtime</span></div>
            <div className="admin-rate-list">
              <Rate label="Tỷ lệ duyệt / đăng bài" value={summary.approvalRate} tone="green" />
              <Rate label="Tỷ lệ hoàn thành trao đổi" value={summary.completionRate} tone="blue" />
              <Rate label="Tỷ lệ bài bị báo cáo" value={summary.reportRate} tone="red" />
            </div>
            <div className="admin-rate-footer"><span>Cập nhật: {summary.updatedAt}</span><button type="button" onClick={rebuildStats}>Đồng bộ thống kê</button></div>
          </article>
          <article className="admin-insight-card admin-rank-card">
            <div className="admin-card-heading"><h2>Top danh mục & lớp học tích cực</h2><span className="admin-card-note">LOCAL_UI_SAMPLE</span></div>
            <div className="admin-rank-grid">
              <RankColumn title="Danh mục nhiều nhất" items={summary.topCategories} />
              <RankColumn title="Top lớp sôi nổi" items={summary.topClasses} isClass />
            </div>
          </article>
        </section>

        <AdminCharts posts={posts} />

        <section className="admin-moderation-card">
          <div className="admin-moderation-header">
            <div className="admin-moderation-title-row">
              <div><h2>Danh sách bài đăng kiểm duyệt</h2><p>Quản lý trạng thái, hiển thị, bình luận và báo cáo của học sinh.</p></div>
              <div className="admin-moderation-actions">
                <button className="admin-primary-button compact" type="button" onClick={approveAll}><CheckIcon />Duyệt tất cả bài mới</button>
                <button className="admin-outline-button compact" type="button" onClick={showSystemHealth}><ShieldIcon />Kiểm tra hệ thống</button>
              </div>
            </div>
            <div className="admin-filter-grid">
              <label className="admin-search-field"><SearchIcon /><input value={keyword} onChange={(event)=>setKeyword(event.target.value)} type="search" placeholder="Tìm tên bài đăng, học sinh, lớp..." autoComplete="off" /></label>
              <select value={status} onChange={(event)=>setStatus(event.target.value as ''|AdminPostStatus)} aria-label="Lọc trạng thái">
                <option value="">Tất cả trạng thái</option><option value="Chờ duyệt">Chờ giáo viên duyệt</option><option value="Đang mở">Đang giao dịch</option><option value="Từ chối">Từ chối</option><option value="Đã xong">Đã hoàn tất</option>
              </select>
              <select value={className} onChange={(event)=>setClassName(event.target.value)} aria-label="Lọc lớp"><option value="">Tất cả lớp</option>{classes.map((item)=><option key={item} value={item}>{item}</option>)}</select>
              <select value={sort} onChange={(event)=>setSort(event.target.value as SortMode)} aria-label="Sắp xếp"><option value="new">Mới nhất</option><option value="old">Cũ nhất</option><option value="reports">Nhiều báo cáo trước</option></select>
            </div>
          </div>

          <div className="admin-content">
            {shown.length ? (
              <div className="admin-table-scroll">
                <table className="admin-review-table">
                  <thead><tr>{['Bài đăng & nội dung','Lớp','Thời gian','Học sinh đăng','Trạng thái','Hiển thị','Bình luận','Báo cáo','Thao tác'].map((item,index)=><th key={item} className={index>=4?'align-center':''}>{item}</th>)}</tr></thead>
                  <tbody>{shown.map((post) => {
                    const archived = post.source === 'Archive';
                    const draft = drafts[post.id] || { status:post.status, visible:!post.hidden, comments:post.commentStatus !== 'Tắt' };
                    const rowClass = [post.status==='Chờ duyệt'?'is-pending':'',post.reportCount?'has-report':'',post.hidden?'is-hidden':''].filter(Boolean).join(' ');
                    const options = STATUS_OPTIONS.includes(post.status) ? STATUS_OPTIONS : [...STATUS_OPTIONS,post.status];
                    const [date,...time] = post.date.split(/\s+/);
                    return (
                      <tr key={post.id} className={rowClass}>
                        <td className="admin-post-cell"><strong>{post.title}</strong><span>{[post.tradeType,post.category,money(post.price)].filter(Boolean).join(' • ')}</span></td>
                        <td><span className="admin-class-chip">{post.className || 'Chưa có'}</span></td>
                        <td className="admin-date-cell"><span>{date || 'Chưa có'}</span><small>{time.join(' ') || post.doneAt || ''}</small></td>
                        <td className="admin-owner-cell"><strong>{post.name || 'Ẩn danh'}</strong><span>{post.emailMasked || 'Email đã ẩn'}</span></td>
                        <td className="align-center admin-status-cell">
                          <span className={`admin-status-pill ${statusClass(post.status)}`}><i />{statusLabel(post.status)}</span>
                          <select className="admin-row-status-select" disabled={archived} value={draft.status} onChange={(event)=>setDraft(post.id,{status:event.target.value as AdminPostStatus})} aria-label="Trạng thái bài đăng">{options.map((item)=><option key={item} value={item}>{statusLabel(item)}</option>)}</select>
                        </td>
                        <td className="align-center admin-visibility-cell"><Switch checked={draft.visible} disabled={archived} label="Hiển thị bài đăng" onChange={(checked)=>setDraft(post.id,{visible:checked})} /></td>
                        <td className="align-center admin-comment-cell"><div className="admin-comment-toggle-wrap"><Switch checked={draft.comments} disabled={archived} label="Cho phép bình luận" onChange={(checked)=>setDraft(post.id,{comments:checked})} /><span className="admin-comment-count">({post.commentCount})</span></div></td>
                        <td className="align-center"><span className={`admin-report-count${post.reportCount?' active':''}`} title={`${post.reportCount} báo cáo`}>{post.reportCount}</span></td>
                        <td className="admin-action-cell"><div className="admin-row-actions"><button type="button" className="admin-table-primary admin-row-save-button" disabled={archived} onClick={()=>saveRow(post)}>Lưu</button><button type="button" className="admin-table-neutral admin-row-detail-button" onClick={()=>openModal(post)}>Chi tiết</button></div></td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
            ) : <div className="state admin-empty-state">Không có bài đăng phù hợp với bộ lọc.</div>}

            <div className="admin-pagination">
              <span className="admin-pagination-info">Hiển thị {filtered.length ? (safePage-1)*PAGE_SIZE+1 : 0} - {Math.min(safePage*PAGE_SIZE,filtered.length)} trong tổng số {filtered.length} bài đăng</span>
              <div className="admin-pagination-buttons">
                <button type="button" disabled={safePage<=1} onClick={()=>setPage(Math.max(1,safePage-1))}>Trước</button>
                {compactPages(totalPages,safePage).map((item,index)=>item==='...' ? <span key={`dots-${index}`}>...</span> : <button type="button" key={item} className={item===safePage?'active':''} onClick={()=>setPage(item)}>{item}</button>)}
                <button type="button" disabled={safePage>=totalPages} onClick={()=>setPage(Math.min(totalPages,safePage+1))}>Sau</button>
              </div>
            </div>
          </div>
        </section>

        <div className="admin-local-tools"><button type="button" className="admin-secondary-button" onClick={resetLocal}>Khôi phục dữ liệu UI local</button></div>
      </main>

      <footer className="admin-footer">© Edu Share+ Admin Dashboard • Hệ thống kiểm duyệt nội dung trường học an toàn</footer>

      {modalPost ? (
        <div className="admin-modal-backdrop" onMouseDown={(event)=>{if(event.currentTarget===event.target)setModalPost(null);}}>
          <section className="admin-post-modal" role="dialog" aria-modal="true" aria-labelledby="adminModalTitle">
            <header className="admin-modal-header"><div><span className="admin-modal-label">CHI TIẾT KIỂM DUYỆT</span><h2 id="adminModalTitle">{modalPost.title}</h2></div><button className="admin-modal-close" type="button" onClick={()=>setModalPost(null)} aria-label="Đóng">×</button></header>
            <div className="admin-modal-body">
              {modalPost.imageUrl ? <img className="admin-modal-image" src={modalPost.imageUrl} alt={modalPost.title} /> : null}
              <div className="admin-modal-meta-grid"><ModalMeta label="Hình thức" value={modalPost.tradeType}/><ModalMeta label="Danh mục" value={modalPost.category}/><ModalMeta label="Lớp" value={modalPost.className}/><ModalMeta label="Ngày đăng" value={modalPost.date}/><ModalMeta label="Người đăng" value={modalPost.name}/><ModalMeta label="Email" value={modalPost.email}/></div>
              <section className="admin-modal-section"><h3>Mô tả bài đăng</h3><p>{modalPost.description || 'Không có mô tả.'}</p></section>
              <section className="admin-modal-section"><h3>Thông tin liên hệ</h3><p>{modalPost.contactInfo || 'Chưa có thông tin liên hệ.'}</p></section>
              {modalPost.rejectionReason ? <section className="admin-modal-section warning"><h3>Lý do từ chối hiện tại</h3><p>{modalPost.rejectionReason}</p></section> : null}
              {modalPost.source !== 'Archive' ? (
                <section className="admin-modal-controls">
                  <h3>Thiết lập kiểm duyệt</h3>
                  <div className="admin-modal-control-grid">
                    <label><span>Trạng thái</span><select value={modalStatus} onChange={(event)=>setModalStatus(event.target.value as AdminPostStatus)}><option value="Chờ duyệt">Chờ duyệt</option><option value="Đang mở">Đang giao dịch</option><option value="Từ chối">Từ chối</option></select></label>
                    <label><span>Bình luận</span><select value={modalComments} onChange={(event)=>setModalComments(event.target.value as CommentStatus)}><option value="Mở">Bật bình luận</option><option value="Tắt">Tắt bình luận</option></select></label>
                    <label className="admin-modal-check"><input type="checkbox" checked={modalHidden} onChange={(event)=>setModalHidden(event.target.checked)} /><span>Ẩn bài khỏi trang công khai</span></label>
                  </div>
                  <label className={`admin-modal-reason${modalStatus==='Từ chối'?' required':''}`}><span>Lý do từ chối</span><textarea rows={3} placeholder="Nhập lý do khi từ chối bài đăng..." value={modalReason} onChange={(event)=>setModalReason(event.target.value)} /></label>
                </section>
              ) : null}
            </div>
            <footer className="admin-modal-footer"><button type="button" className="admin-secondary-button" onClick={()=>setModalPost(null)}>Đóng</button>{modalPost.source !== 'Archive' ? <button type="button" className="admin-primary-button" onClick={saveModal}>Lưu thay đổi</button> : null}</footer>
          </section>
        </div>
      ) : null}
    </>
  );
}

function SummaryCard({label,value,note,tone,icon}:{label:string;value:string|number;note:string;tone:string;icon:string}) {
  return <article className={`admin-summary-card tone-${tone}`}><div className="admin-summary-card-head"><span className="admin-summary-label">{label}</span><span className="admin-summary-icon">{icon}</span></div><strong>{value}</strong><small>{note}</small></article>;
}

function Rate({label,value,tone}:{label:string;value:number;tone:'green'|'blue'|'red'}) {
  const safe = Math.max(0,Math.min(100,value));
  return <div className="admin-rate-item"><div className="admin-rate-row"><span>{label}</span><b className={`rate-${tone}`}>{safe.toFixed(1)}%</b></div><div className="admin-rate-track"><i className={`rate-${tone}`} style={{width:`${Math.max(tone==='red'&&safe>0?2:0,safe)}%`}} /></div></div>;
}

function RankColumn({title,items,isClass=false}:{title:string;items:Array<{name:string;count:number}>;isClass?:boolean}) {
  const medals = ['🥇','🥈','🥉'];
  return <div className="admin-rank-column"><h3>{title}</h3><div className="admin-rank-list">{items.length ? items.slice(0,4).map((item,index)=><div key={item.name} className={`admin-rank-row${isClass&&index===0?' featured':''}`}><span>{isClass&&index<3?`${medals[index]} `:`${index+1}. `}{item.name}</span><b>{item.count}{isClass?' lượt':' món'}</b></div>) : <div className="admin-rank-empty">Chưa có dữ liệu.</div>}</div></div>;
}

function Switch({checked,disabled,label,onChange}:{checked:boolean;disabled:boolean;label:string;onChange:(checked:boolean)=>void}) {
  return <label className={`admin-switch${disabled?' is-disabled':''}`} title={label}><input className="admin-switch-input" type="checkbox" checked={checked} disabled={disabled} onChange={(event)=>onChange(event.target.checked)} aria-label={label}/><span className="admin-switch-track" aria-hidden="true"><span className="admin-switch-thumb"/></span></label>;
}

function ModalMeta({label,value}:{label:string;value:string}) { return <div className="admin-modal-meta"><span>{label}</span><strong>{value || 'Chưa có'}</strong></div>; }

function AdminCharts({posts}:{posts:AdminPost[]}) {
  const monthData = [2,4,3,5,6,4,7,8];
  const categories = useMemo(() => {
    const map = new Map<string,number>(); posts.forEach((post)=>map.set(post.category,(map.get(post.category)||0)+1));
    return [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6);
  },[posts]);
  const trades = useMemo(() => {
    const map = new Map<string,number>(); posts.forEach((post)=>map.set(post.tradeType,(map.get(post.tradeType)||0)+1));
    return [...map.entries()];
  },[posts]);
  const hot = useMemo(() => [...posts].sort((a,b)=>(b.favoriteCount+b.contactCount+b.commentCount)-(a.favoriteCount+a.contactCount+a.commentCount)).slice(0,5),[posts]);
  return <section className="admin-chart-dashboard"><div className="admin-chart-heading"><div><h2>Biểu đồ dashboard</h2><p>Theo dõi xu hướng hoàn tất, danh mục, hình thức giao dịch và bài nổi bật.</p></div><span className="admin-card-note">LOCAL_UI_SAMPLE</span></div><div className="admin-chart-grid">
    <article className="admin-chart-panel"><h3>Hoàn tất theo tháng</h3><div className="admin-chart-canvas"><LineChart values={monthData}/></div></article>
    <article className="admin-chart-panel"><h3>Tác động theo danh mục</h3><div className="admin-chart-canvas"><BarChart items={categories}/></div></article>
    <article className="admin-chart-panel"><h3>Cơ cấu hình thức</h3><div className="admin-chart-canvas"><DonutChart items={trades}/></div></article>
    <article className="admin-chart-panel"><h3>Top bài nổi bật</h3><div className="admin-chart-canvas"><HotChart items={hot}/></div></article>
  </div></section>;
}

function LineChart({values}:{values:number[]}) {
  const max = Math.max(...values,1); const width=460, height=165, pad=14;
  const points = values.map((value,index)=>`${pad+(index*(width-pad*2))/(values.length-1)},${height-pad-(value/max)*(height-pad*2)}`).join(' ');
  return <div className="admin-local-line"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Biểu đồ hoàn tất theo tháng"><g className="admin-local-grid"><line x1="14" y1="40" x2="446" y2="40"/><line x1="14" y1="82" x2="446" y2="82"/><line x1="14" y1="124" x2="446" y2="124"/></g><polyline points={points} fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round"/>{values.map((value,index)=>{const [x,y]=points.split(' ')[index].split(',');return <circle key={index} cx={x} cy={y} r="4" fill="currentColor"><title>{value} giao dịch mẫu</title></circle>;})}</svg><div className="admin-local-months"><span>T1</span><span>T2</span><span>T3</span><span>T4</span><span>T5</span><span>T6</span><span>T7</span><span>T8</span></div></div>;
}

function BarChart({items}:{items:Array<[string,number]>}) {
  const max=Math.max(...items.map(([,value])=>value),1);
  return <div className="admin-local-bars">{items.map(([label,value])=><div className="admin-local-bar" key={label}><span>{label}</span><i><b style={{height:`${Math.max(12,(value/max)*100)}%`}} /></i><strong>{value}</strong></div>)}</div>;
}

function DonutChart({items}:{items:Array<[string,number]>}) {
  const total=items.reduce((sum,[,value])=>sum+value,0)||1;
  let cursor=0; const colors=['#ee4d2d','#f59e0b','#10b981','#2563eb'];
  const segments=items.map(([,value],index)=>{const start=cursor; cursor+=(value/total)*360; return `${colors[index%colors.length]} ${start}deg ${cursor}deg`;}).join(',');
  return <div className="admin-local-donut-wrap"><div className="admin-local-donut" style={{background:`conic-gradient(${segments})`}}><span><b>{total}</b><small>bài mẫu</small></span></div><div className="admin-local-legend">{items.map(([label,value],index)=><div key={label}><i style={{background:colors[index%colors.length]}}/><span>{label}</span><b>{value}</b></div>)}</div></div>;
}

function HotChart({items}:{items:AdminPost[]}) {
  const values=items.map((post)=>post.favoriteCount+post.contactCount+post.commentCount); const max=Math.max(...values,1);
  return <div className="admin-local-hot">{items.map((post,index)=><div key={post.id}><span title={post.title}>{post.title}</span><i><b style={{width:`${(values[index]/max)*100}%`}}/></i><strong>{values[index]}</strong></div>)}</div>;
}

function ShieldIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.3 20 5v5.8c0 5.1-3.4 9.4-8 10.9-4.6-1.5-8-5.8-8-10.9V5l8-2.7Zm0 4.1-4.6 1.5v3c0 3.2 1.9 6.1 4.6 7.4 2.7-1.3 4.6-4.2 4.6-7.4v-3L12 6.4Z"/></svg>}
function BellIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Zm-8.2 11a2.4 2.4 0 0 0 4.4 0H9.8Z"/></svg>}
function LogoutIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5v-2H5V5h5V3Zm4.6 4.6L13.2 9l2 2H8v2h7.2l-2 2 1.4 1.4L19 12l-4.4-4.4Z"/></svg>}
function RefreshIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.7 6.3A8 8 0 1 0 20 12h-2a6 6 0 1 1-1.8-4.3L13 11h8V3l-3.3 3.3Z"/></svg>}
function DocumentIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm1 3.5L18.5 9H15V5.5ZM8 13h8v2H8v-2Zm0 4h8v2H8v-2Z"/></svg>}
function CheckIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 16.2-3.5-3.5L4 14.2l5 5 11-11-1.5-1.4L9 16.2Zm0-6-1.5 1.5L9 13.2l7-7-1.5-1.4L9 10.2Z"/></svg>}
function SearchIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 19.6-5.2-5.2a7 7 0 1 0-1.4 1.4l5.2 5.2 1.4-1.4ZM5 10a5 5 0 1 1 10 0 5 5 0 0 1-10 0Z"/></svg>}
