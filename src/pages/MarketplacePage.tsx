import { useEffect, useMemo, useRef, useState } from 'react';
import { navigateLegacy } from '../app/legacyRouter';
import StudentHeader from '../components/student/StudentHeader';
import { MarketplacePostCard, MarketplaceSmartStrip, MarketStatIcon } from '../features/marketplace/components/MarketplaceCards';
import MarketplacePagination from '../features/marketplace/components/MarketplacePagination';
import { LOCAL_UI_SAMPLE_POSTS } from '../features/marketplace/mockPosts';
import type { MarketFilters, MarketSort, SmartMode, TradeType } from '../features/marketplace/types';
import { CATEGORIES, normalizeMarketText, PAGE_SIZE, TRADE_TYPES } from '../features/marketplace/viewUtils';
import { getSavedPostIdsLocal, togglePostSavedLocal } from '../features/profile/localProfileStore';

const INITIAL_FILTERS: MarketFilters = { kw:'', trade:'', category:'', className:'', sort:'new', smartMode:'off' };

function getInitialSearchKeyword():string {
  return new URLSearchParams(window.location.search).get('search')?.trim() || '';
}

export default function MarketplacePage() {
  const initialSearch = getInitialSearchKeyword();
  const [filters,setFilters]=useState<MarketFilters>(() => ({ ...INITIAL_FILTERS, kw:initialSearch }));
  const [heroKeyword,setHeroKeyword]=useState(initialSearch);
  const [page,setPage]=useState(1);
  const [savedIds,setSavedIds]=useState<Set<string>>(()=>getSavedPostIdsLocal());
  const filtersRef=useRef<HTMLElement | null>(null);

  const classes=useMemo(()=>Array.from(new Set(LOCAL_UI_SAMPLE_POSTS.map((post)=>post.className))).sort((a,b)=>a.localeCompare(b,'vi')),[]);
  const globalStats=useMemo(()=>({
    totalOpen:LOCAL_UI_SAMPLE_POSTS.length,
    free:LOCAL_UI_SAMPLE_POSTS.filter((post)=>post.price<=0).length,
    sale:LOCAL_UI_SAMPLE_POSTS.filter((post)=>post.tradeType==='Bán giá rẻ').length,
    hasImage:LOCAL_UI_SAMPLE_POSTS.filter((post)=>post.hasImage).length,
  }),[]);

  const filteredPosts=useMemo(()=>{
    const keyword=normalizeMarketText(filters.kw);
    let posts=LOCAL_UI_SAMPLE_POSTS.filter((post)=>{
      if(filters.trade && post.tradeType!==filters.trade) return false;
      if(filters.category && post.category!==filters.category) return false;
      if(filters.className && post.className!==filters.className) return false;
      if(keyword){
        const search=normalizeMarketText([post.id,post.title,post.description,post.name,post.className,post.tradeType,post.category,String(post.price)].join(' '));
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

        {filters.smartMode!=='off' ? <MarketplaceSmartStrip posts={filteredPosts} mode={filters.smartMode} filteredCount={filteredPosts.length}/> : null}

        <div className="listing-title">
          <div><span className="eyebrow">SẢN PHẨM ĐANG MỞ</span><h2>Khám phá đồ dùng học tập</h2></div>
          <button className="btn primary" type="button" onClick={()=>navigateLegacy('add')}>+ Đăng bài</button>
        </div>

        <section className="post-grid">
          {pagePosts.length ? pagePosts.map((post)=><MarketplacePostCard key={post.id} post={post} saved={savedIds.has(post.id)} onToggleSaved={()=>{ const nextSaved=togglePostSavedLocal(post.id); setSavedIds((current)=>{ const next=new Set(current); if(nextSaved) next.add(post.id); else next.delete(post.id); return next; }); }}/>) : <div className="state">Chưa có bài đăng phù hợp.</div>}
        </section>

        <MarketplacePagination totalPages={totalPages} safePage={safePage} filteredCount={filteredPosts.length} onChange={changePage} />
      </main>
      <footer className="page-footer">Edu Share+ • Chia sẻ đồ dùng học tập an toàn trong trường</footer>
    </>
  );
}
