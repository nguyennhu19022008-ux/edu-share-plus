import { useEffect, useMemo, useRef, useState } from 'react';
import { navigateLegacy } from '../app/legacyRouter';
import StudentHeader from '../components/student/StudentHeader';
import { LOCAL_UI_SAMPLE_POSTS } from '../features/marketplace/mockPosts';
import { getSavedPostIdsLocal, togglePostSavedLocal } from '../features/profile/localProfileStore';
import type { MarketFilters, MarketPost, MarketSort, SmartMode, TradeType } from '../features/marketplace/types';

const PAGE_SIZE = 12;
const INITIAL_FILTERS: MarketFilters = { kw:'', trade:'', category:'', className:'', sort:'new', smartMode:'off' };

function getInitialSearchKeyword():string {
  return new URLSearchParams(window.location.search).get('search')?.trim() || '';
}
const CATEGORIES = ['Sách','Sách giáo khoa','Sách tham khảo','Dụng cụ học tập','Vở','Bút','Đồng phục','Đồ điện tử nhỏ','Khác'];
const TRADE_TYPES: TradeType[] = ['Cho mượn','Cho tặng','Trao đổi','Bán giá rẻ'];

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').trim();
}

function formatMoney(value: number) {
  return `${new Intl.NumberFormat('vi-VN').format(value)} ₫`;
}

function formatCardDate(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/\d{4}\s+(\d{2}:\d{2})/);
  return match ? `${match[3]} • ${match[1]}/${match[2]}` : value;
}

function tradeClass(value: TradeType) {
  if (value === 'Bán giá rẻ') return 'sale';
  if (value === 'Cho tặng') return 'gift';
  if (value === 'Cho mượn') return 'loan';
  return 'exchange';
}

function reputationTone(score: number) {
  if (score >= 8) return 'excellent';
  if (score >= 6) return 'good';
  if (score >= 4) return 'normal';
  return 'caution';
}

function MarketStatIcon({ type }: { type:'list'|'gift'|'tag'|'image' }) {
  const icons = {
    list:<svg viewBox="0 0 24 24" fill="none"><path d="M9 6h11M9 12h11M9 18h11" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/><path d="m4 6 1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    gift:<svg viewBox="0 0 24 24" fill="none"><path d="M4 10h16v10H4V10Zm-1-4h18v4H3V6Zm9 0v14" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M12 6H8.7A2.2 2.2 0 1 1 11 3.8L12 6Zm0 0h3.3A2.2 2.2 0 1 0 13 3.8L12 6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>,
    tag:<svg viewBox="0 0 24 24" fill="none"><path d="M20 13 13 20l-9-9V4h7l9 9Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><circle cx="8.5" cy="8.5" r="1.4" fill="currentColor"/></svg>,
    image:<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8"/><circle cx="8.5" cy="9" r="1.5" stroke="currentColor" strokeWidth="1.6"/><path d="m5 18 4.2-4.2 3 3 2.3-2.3L19 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  };
  return <span className="market-stat-icon" aria-hidden="true">{icons[type]}</span>;
}

function SmartStrip({ posts, mode, filteredCount }: { posts:MarketPost[]; mode:Exclude<SmartMode,'off'>; filteredCount:number }) {
  if (!posts.length) return null;
  const isAi = mode === 'ai';
  return (
    <section className="v26-feed-section">
      <div className="v26-feed-head">
        <div>
          <h2>{isAi ? 'AI gợi ý trong kết quả đang lọc' : 'Ranking trong kết quả đang lọc'}</h2>
          <div className="subtext">
            {isAi
              ? 'AI chỉ xếp hạng các bài đã qua bộ lọc hiện tại, không tự bỏ qua danh mục/lớp/từ khóa bạn chọn.'
              : 'Ranking xếp hạng các bài đã qua bộ lọc hiện tại theo lượt lưu, bình luận, xem liên hệ và độ mới.'}
            {' '}• {filteredCount} bài phù hợp.
          </div>
        </div>
        <span className="ai-badge">{isAi ? 'AI đề xuất' : 'Ranking nâng cao'}</span>
      </div>
      <div className="v26-strip">
        {posts.slice(0,6).map((post) => (
          <article className="v26-mini-card" key={post.id}>
            <div className="v26-mini-title">{post.title}</div>
            <div className="tags"><span className="tag cat">{post.category}</span><span className="tag">{post.tradeType}</span></div>
            <div className="meta">Lớp {post.className} • {post.date}</div>
            <div className="v26-rank-line"><span>Điểm: {isAi ? post.aiScore : post.rankScore}</span><span>♥ {post.favoriteCount}</span></div>
            <div className="muted v26-reason">{post.recommendationReason}</div>
            <button className="btn small primary" type="button" onClick={() => navigateLegacy('detail',{ id:post.id })}>Xem</button>
          </article>
        ))}
      </div>
    </section>
  );
}

function PostCard({ post, saved, onToggleSaved }: { post:MarketPost; saved:boolean; onToggleSaved:()=>void }) {
  const score = Math.max(0, Math.min(10, post.ownerReputationScore));
  return (
    <article className="post-card market-product-card">
      <div className="market-product-card-body">
        <div className="market-product-card-top">
          <div className="market-product-card-tags">
            <span className={`market-product-tag ${tradeClass(post.tradeType)}`}>{post.tradeType}</span>
            <span className="market-product-tag category">{post.category}</span>
          </div>
          {post.price > 0 ? <strong className="market-product-price">{formatMoney(post.price)}</strong> : null}
        </div>

        <h3 className="market-product-title">{post.title}</h3>

        <div className={`market-product-reputation ${reputationTone(score)}`}>
          <span>Mức độ uy tín</span>
          <strong>{Number.isInteger(score) ? score : score.toFixed(1)}/10{post.ownerReputationLabel ? ` (${post.ownerReputationLabel})` : ''}</strong>
        </div>

        <div className="market-product-card-footer">
          <div className="market-product-owner">
            <strong>{post.name}{post.className ? ` - ${post.className}` : ''}</strong>
            <span>Đăng lúc: {formatCardDate(post.date)}</span>
          </div>
          <div className="market-product-actions">
            <button className={`market-card-save-btn${saved ? ' saved' : ''}`} type="button" title={saved ? 'Bỏ lưu bài' : 'Lưu bài'} aria-label={saved ? 'Bỏ lưu bài' : 'Lưu bài'} aria-pressed={saved} onClick={onToggleSaved}>
              {saved
                ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 4.5A2.5 2.5 0 0 1 9 2h6a2.5 2.5 0 0 1 2.5 2.5V21L12 17.4 6.5 21V4.5Z" fill="currentColor"/></svg>
                : <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 4.5A2.5 2.5 0 0 1 9.5 2h5A2.5 2.5 0 0 1 17 4.5V21l-5-3.4L7 21V4.5Z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round"/></svg>}
            </button>
            <button className="btn market-card-detail-btn" type="button" onClick={() => navigateLegacy('detail',{ id:post.id })}>Xem chi tiết</button>
          </div>
        </div>
      </div>
    </article>
  );
}

function compactPageList(totalPages:number, activePage:number): Array<number|'...'> {
  if (totalPages <= 7) return Array.from({ length:totalPages },(_,index)=>index+1);
  const pages:Array<number|'...'>=[1];
  const start=Math.max(2,activePage-1), end=Math.min(totalPages-1,activePage+1);
  if(start>2) pages.push('...');
  for(let page=start; page<=end; page++) pages.push(page);
  if(end<totalPages-1) pages.push('...');
  pages.push(totalPages);
  return pages;
}

export default function MarketplacePage() {
  const initialSearch = getInitialSearchKeyword();
  const [filters,setFilters]=useState<MarketFilters>(() => ({ ...INITIAL_FILTERS, kw:initialSearch }));
  const [heroKeyword,setHeroKeyword]=useState(initialSearch);
  const [page,setPage]=useState(1);
  const [savedIds,setSavedIds]=useState<Set<string>>(()=>getSavedPostIdsLocal());
  const filtersRef=useRef<HTMLElement | null>(null);

  useEffect(()=>{
    document.body.className='ecommerce-body';
    return()=>{ document.body.className=''; };
  },[]);

  const classes=useMemo(()=>Array.from(new Set(LOCAL_UI_SAMPLE_POSTS.map((post)=>post.className))).sort((a,b)=>a.localeCompare(b,'vi')),[]);
  const globalStats=useMemo(()=>({
    totalOpen:LOCAL_UI_SAMPLE_POSTS.length,
    free:LOCAL_UI_SAMPLE_POSTS.filter((post)=>post.price<=0).length,
    sale:LOCAL_UI_SAMPLE_POSTS.filter((post)=>post.tradeType==='Bán giá rẻ').length,
    hasImage:LOCAL_UI_SAMPLE_POSTS.filter((post)=>post.hasImage).length,
  }),[]);

  const filteredPosts=useMemo(()=>{
    const keyword=normalize(filters.kw);
    let posts=LOCAL_UI_SAMPLE_POSTS.filter((post)=>{
      if(filters.trade && post.tradeType!==filters.trade) return false;
      if(filters.category && post.category!==filters.category) return false;
      if(filters.className && post.className!==filters.className) return false;
      if(keyword){
        const search=normalize([post.id,post.title,post.description,post.name,post.className,post.tradeType,post.category,String(post.price)].join(' '));
        if(!search.includes(keyword)) return false;
      }
      return true;
    });

    if(filters.smartMode==='rank') posts=[...posts].sort((a,b)=>b.rankScore-a.rankScore || b.dateTs-a.dateTs);
    else if(filters.smartMode==='ai') posts=[...posts].sort((a,b)=>b.aiScore-a.aiScore || b.dateTs-a.dateTs);
    else if(filters.sort==='priceAsc') posts=[...posts].sort((a,b)=>a.price-b.price || b.dateTs-a.dateTs);
    else if(filters.sort==='priceDesc') posts=[...posts].sort((a,b)=>b.price-a.price || b.dateTs-a.dateTs);
    else if(filters.sort==='image') posts=[...posts].sort((a,b)=>Number(b.hasImage)-Number(a.hasImage) || b.dateTs-a.dateTs);
    else posts=[...posts].sort((a,b)=>b.dateTs-a.dateTs);
    return posts;
  },[filters]);

  const totalPages=Math.max(1,Math.ceil(filteredPosts.length/PAGE_SIZE));
  const safePage=Math.min(page,totalPages);
  const pagePosts=filteredPosts.slice((safePage-1)*PAGE_SIZE,safePage*PAGE_SIZE);

  useEffect(()=>{ if(page!==safePage) setPage(safePage); },[page,safePage]);

  const updateFilter=<K extends keyof MarketFilters>(key:K,value:MarketFilters[K])=>{
    setFilters((current)=>({ ...current,[key]:value }));
    setPage(1);
  };

  const runHeroSearch=()=>{
    updateFilter('kw',heroKeyword);
    window.setTimeout(()=>filtersRef.current?.scrollIntoView({ behavior:'smooth',block:'center' }),0);
  };

  const setSmartMode=(mode:Exclude<SmartMode,'off'>,checked:boolean)=>updateFilter('smartMode',checked ? mode : 'off');

  const changePage=(target:number)=>{
    setPage(target);
    try{ window.scrollTo({ top:0,behavior:'smooth' }); }catch{ window.scrollTo(0,0); }
  };

  return (
    <>
      <StudentHeader activePage="index" />
      <main className="container ecom-page market-page">
        <section className="market-hero">
          <div className="market-hero-copy">
            <span className="eyebrow">CHỢ ĐỒ DÙNG HỌC TẬP</span>
            <h1>Lướt nhanh, tìm đúng món đồ bạn cần</h1>
            <p>Các bài đang hiển thị đều đã qua bước kiểm duyệt của giáo viên.</p>
            <div className="hero-search">
              <input value={heroKeyword} onChange={(event)=>setHeroKeyword(event.target.value)} onKeyDown={(event)=>{ if(event.key==='Enter') runHeroSearch(); }} placeholder="Tìm sách, vở, bút, đồng phục, máy tính..." />
              <button className="btn primary" type="button" onClick={runHeroSearch}>Tìm kiếm</button>
            </div>
          </div>
          <aside className="market-banner">
            <span>EDU DEAL</span>
            <b>Chia sẻ để<br/>tiết kiệm hơn</b>
            <p>Cho mượn • Cho tặng • Trao đổi • Bán giá rẻ</p>
            <button className="btn light" type="button" onClick={()=>navigateLegacy('add')}>+ Đăng bài mới</button>
          </aside>
        </section>

        <section className="market-stat-grid" aria-label="Thống kê bài đăng">
          <article className="market-stat-card tone-blue"><div className="market-stat-copy"><span className="market-stat-label">Bài đăng hiển thị</span><strong className="market-stat-value">{globalStats.totalOpen}</strong></div><MarketStatIcon type="list"/></article>
          <article className="market-stat-card tone-green"><div className="market-stat-copy"><span className="market-stat-label">Miễn phí / thỏa thuận</span><strong className="market-stat-value">{globalStats.free}</strong></div><MarketStatIcon type="gift"/></article>
          <article className="market-stat-card tone-orange"><div className="market-stat-copy"><span className="market-stat-label">Bán giá rẻ</span><strong className="market-stat-value">{globalStats.sale}</strong></div><MarketStatIcon type="tag"/></article>
          <article className="market-stat-card tone-violet"><div className="market-stat-copy"><span className="market-stat-label">Có ảnh minh họa</span><strong className="market-stat-value">{globalStats.hasImage}</strong></div><MarketStatIcon type="image"/></article>
        </section>

        <section ref={filtersRef} className="toolbar market-toolbar market-filter-card" aria-label="Bộ lọc bài đăng">
          <div className="market-filter-head">
            <div className="market-filter-heading">
              <span className="market-filter-heading-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M4 7h10M18 7h2M4 17h2M10 17h10M8 4v6M8 14v6M16 4v6M16 14v6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/></svg></span>
              <span>Bộ lọc tìm kiếm</span>
            </div>
            <button className="market-clear-filter" type="button" onClick={()=>{ setFilters(INITIAL_FILTERS); setHeroKeyword(''); setPage(1); }}>Xóa bộ lọc</button>
          </div>

          <div className="market-filter-main">
            <div className="market-filter-search">
              <span aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8"/><path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg></span>
              <input aria-label="Tìm kiếm bài đăng" value={filters.kw} onChange={(event)=>updateFilter('kw',event.target.value)} placeholder="Tìm theo tiêu đề, mô tả, môn học, người đăng..." />
            </div>
            <select aria-label="Lọc theo hình thức" value={filters.trade} onChange={(event)=>updateFilter('trade',event.target.value as ''|TradeType)}>
              <option value="">Tất cả loại hình (Cho/Tặng/Bán)</option>{TRADE_TYPES.map((type)=><option key={type}>{type}</option>)}
            </select>
            <select aria-label="Lọc theo danh mục" value={filters.category} onChange={(event)=>updateFilter('category',event.target.value)}>
              <option value="">Tất cả danh mục</option>{CATEGORIES.map((category)=><option key={category}>{category}</option>)}
            </select>
            <select aria-label="Lọc theo lớp" value={filters.className} onChange={(event)=>updateFilter('className',event.target.value)}>
              <option value="">Tất cả lớp học</option>{classes.map((className)=><option key={className}>{className}</option>)}
            </select>
          </div>

          <div className="market-filter-divider" />
          <div className="market-filter-bottom">
            <div className="market-sort-control">
              <span>Sắp xếp:</span>
              <select aria-label="Sắp xếp bài đăng" value={filters.sort} onChange={(event)=>updateFilter('sort',event.target.value as MarketSort)}>
                <option value="new">Mới nhất</option><option value="priceAsc">Giá thấp trước</option><option value="priceDesc">Giá cao trước</option><option value="image">Có ảnh trước</option>
              </select>
            </div>
            <div className="market-smart-switches" aria-label="Tùy chọn gợi ý thông minh">
              <label className="market-switch-control">
                <span>Bật xếp hạng theo uy tín</span>
                <input type="checkbox" checked={filters.smartMode==='rank'} onChange={(event)=>setSmartMode('rank',event.target.checked)} />
                <span className="market-switch" aria-hidden="true" />
              </label>
              <span className="market-switch-separator" aria-hidden="true" />
              <label className="market-switch-control market-switch-control-ai">
                <span className="market-spark" aria-hidden="true">✦</span><span>Bật gợi ý đồ dùng</span>
                <input type="checkbox" checked={filters.smartMode==='ai'} onChange={(event)=>setSmartMode('ai',event.target.checked)} />
                <span className="market-switch" aria-hidden="true" />
              </label>
            </div>
          </div>
        </section>

        {filters.smartMode!=='off' ? <SmartStrip posts={filteredPosts} mode={filters.smartMode} filteredCount={filteredPosts.length}/> : null}

        <div className="listing-title">
          <div><span className="eyebrow">SẢN PHẨM ĐANG MỞ</span><h2>Khám phá đồ dùng học tập</h2></div>
          <button className="btn primary" type="button" onClick={()=>navigateLegacy('add')}>+ Đăng bài</button>
        </div>

        <section className="post-grid">
          {pagePosts.length ? pagePosts.map((post)=><PostCard key={post.id} post={post} saved={savedIds.has(post.id)} onToggleSaved={()=>{ const nextSaved=togglePostSavedLocal(post.id); setSavedIds((current)=>{ const next=new Set(current); if(nextSaved) next.add(post.id); else next.delete(post.id); return next; }); }}/>) : <div className="state">Chưa có bài đăng phù hợp.</div>}
        </section>

        <div className="pagination-wrap">
          {totalPages<=1 ? <span className="page-info">{filteredPosts.length} bài phù hợp</span> : <>
            <button className="page-btn" type="button" disabled={safePage<=1} onClick={()=>changePage(safePage-1)}>‹</button>
            {compactPageList(totalPages,safePage).map((item,index)=>item==='...' ? <span className="page-info" key={`ellipsis-${index}`}>...</span> : <button className={`page-btn${item===safePage?' active':''}`} type="button" key={item} onClick={()=>changePage(item)}>{item}</button>)}
            <button className="page-btn" type="button" disabled={safePage>=totalPages} onClick={()=>changePage(safePage+1)}>›</button>
            <span className="page-info">Trang {safePage}/{totalPages} • {filteredPosts.length} bài phù hợp</span>
          </>}
        </div>
      </main>
      <footer className="page-footer">Edu Share+ • Chia sẻ đồ dùng học tập an toàn trong trường</footer>
    </>
  );
}
