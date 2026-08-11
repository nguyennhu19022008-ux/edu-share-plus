import { useEffect, useMemo, useState } from 'react';
import { useDataAccess } from '../app/providers/DataAccessProvider';
import type { AdminPost, AdminPostStatus, CommentStatus } from '../features/admin/types';
import { AdminModalMeta, AdminSwitch, CheckIcon, SearchIcon, ShieldIcon, adminStatusClass, adminStatusLabel } from '../features/admin/components/AdminVisuals';
import { AdminOverview, AdminPageHeading, AdminTopbar } from '../features/admin/components/AdminShellSections';

const PAGE_SIZE = 6;
const STATUS_OPTIONS:AdminPostStatus[] = ['Chờ duyệt','Đang mở','Từ chối'];

type SortMode = 'new' | 'old' | 'reports';
type Draft = { status:AdminPostStatus; visible:boolean; comments:boolean };
type Notice = { tone:'ok'|'warn'; text:string } | null;

function money(value:number):string {
  if (!value) return '';
  return new Intl.NumberFormat('vi-VN').format(value) + 'đ';
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
  const { admin } = useDataAccess();
  const [posts, setPosts] = useState<AdminPost[]>(() => admin.listPosts());
  const [drafts, setDrafts] = useState<Record<string,Draft>>(() => buildDrafts(admin.listPosts()));
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

  const summary = useMemo(() => admin.getDashboardSummary(), [posts]);
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
    const next = admin.listPosts();
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

    admin.updatePost(post.id, {
      status:draft.status,
      hidden:!draft.visible,
      commentStatus:draft.comments ? 'Mở' : 'Tắt',
      rejectionReason,
    });
    syncPosts(`Đã lưu thay đổi kiểm duyệt cho “${post.title}” trong phiên local.`);
  };

  const openModal = (post:AdminPost) => {
    const latest = admin.getPostById(post.id) || post;
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
    admin.updatePost(modalPost.id, {
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
    const count = admin.approveAllPending();
    syncPosts(`Đã duyệt ${count} bài đang chờ trong phiên local.`);
  };

  const refresh = () => {
    setPosts(admin.listPosts());
    setDrafts(buildDrafts(admin.listPosts()));
    setNotice({ tone:'ok', text:'Đã làm mới dashboard từ local in-memory store. Chưa có request backend.' });
  };

  const rebuildStats = () => {
    if (!window.confirm('Đồng bộ lại cache và thống kê quản trị local?')) return;
    setPosts([...admin.listPosts()]);
    setNotice({ tone:'ok', text:'Đã tính lại thống kê từ LOCAL_UI_SAMPLE. Không có dữ liệu nghiên cứu nào bị thay đổi.' });
  };

  const resetLocal = () => {
    if (!window.confirm('Khôi phục toàn bộ dữ liệu kiểm thử 1H về trạng thái ban đầu?')) return;
    const next = admin.resetPosts();
    setPosts(next);
    setDrafts(buildDrafts(next));
    setKeyword(''); setStatus(''); setClassName(''); setSort('new'); setPage(1);
    setNotice({ tone:'ok', text:'Đã khôi phục LOCAL_UI_SAMPLE của Checkpoint 1H.' });
  };

  const showSystemHealth = () => {
    const current = admin.listPosts();
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
      <AdminTopbar alertCount={summary.pending + summary.reports} onNotify={() => setNotice({tone:'ok',text:'Không có thông báo backend ở Phase 1. Badge chỉ là trạng thái UI local.'})} />

      <main className="admin-shell">
        <AdminPageHeading onRefresh={refresh} onExportPdf={exportPdf} />

        {notice ? <div className={`checkpoint-state admin-local-state ${notice.tone === 'ok' ? 'is-ok' : ''}`} role="status">{notice.text}</div> : null}

        <AdminOverview summary={summary} posts={posts} onRebuildStats={rebuildStats} />

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
                          <span className={`admin-status-pill ${adminStatusClass(post.status)}`}><i />{adminStatusLabel(post.status)}</span>
                          <select className="admin-row-status-select" disabled={archived} value={draft.status} onChange={(event)=>setDraft(post.id,{status:event.target.value as AdminPostStatus})} aria-label="Trạng thái bài đăng">{options.map((item)=><option key={item} value={item}>{adminStatusLabel(item)}</option>)}</select>
                        </td>
                        <td className="align-center admin-visibility-cell"><AdminSwitch checked={draft.visible} disabled={archived} label="Hiển thị bài đăng" onChange={(checked)=>setDraft(post.id,{visible:checked})} /></td>
                        <td className="align-center admin-comment-cell"><div className="admin-comment-toggle-wrap"><AdminSwitch checked={draft.comments} disabled={archived} label="Cho phép bình luận" onChange={(checked)=>setDraft(post.id,{comments:checked})} /><span className="admin-comment-count">({post.commentCount})</span></div></td>
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
              <div className="admin-modal-meta-grid"><AdminModalMeta label="Hình thức" value={modalPost.tradeType}/><AdminModalMeta label="Danh mục" value={modalPost.category}/><AdminModalMeta label="Lớp" value={modalPost.className}/><AdminModalMeta label="Ngày đăng" value={modalPost.date}/><AdminModalMeta label="Người đăng" value={modalPost.name}/><AdminModalMeta label="Email" value={modalPost.email}/></div>
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
