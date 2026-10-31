import { useEffect, useMemo, useRef, useState } from 'react';
import { navigateLegacy } from '../app/legacyRouter';
import StudentHeader from '../components/student/StudentHeader';
import { useStudentAuth } from '../features/auth/session/AuthSessionProvider';
import { listMySavedPosts, setPostSaved } from '../features/interactions/interactionService';
import { SkeletonMarketplaceGrid } from '../components/common/Skeleton';
import { StickerLoader } from '../components/common/StickerLoader';
import { MarketplacePostCard, MarketplaceSmartStrip, MarketStatIcon } from '../features/marketplace/components/MarketplaceCards';
import MarketplacePagination from '../features/marketplace/components/MarketplacePagination';
import { deriveMarketplacePageState } from '../features/marketplace/marketplacePageModel';
import {
  type MarketplaceReadResponse,
} from '../features/marketplace/marketplaceReadModel';
import { listMarketplacePosts } from '../features/marketplace/marketplaceReadService';
import type { MarketSort, SmartMode, TradeType } from '../features/marketplace/types';
import { PAGE_SIZE, TRADE_TYPES } from '../features/marketplace/viewUtils';

const EMPTY_RESPONSE: MarketplaceReadResponse = {
  items:[],
  totalCount:0,
  page:1,
  pageSize:PAGE_SIZE,
  totalPages:0,
  stats:{ totalOpen:0, free:0, sale:0, hasImage:0 },
  classes:[],
  categories:[],
};

type ServerFilters = {
  tradeType:'' | TradeType;
  categoryId:string;
  classId:string;
  sort:MarketSort;
};

const INITIAL_FILTERS:ServerFilters = {
  tradeType:'',
  categoryId:'',
  classId:'',
  sort:'new',
};

function getInitialSearchKeyword():string {
  return new URLSearchParams(window.location.search).get('search')?.trim() || '';
}

export default function MarketplacePage() {
  const auth = useStudentAuth();
  const initialSearch = getInitialSearchKeyword();
  const [keyword,setKeyword] = useState(initialSearch);
  const [debouncedKeyword,setDebouncedKeyword] = useState(initialSearch);
  const [heroKeyword,setHeroKeyword] = useState(initialSearch);
  const [filters,setFilters] = useState<ServerFilters>(INITIAL_FILTERS);
  const [smartMode,setSmartMode] = useState<SmartMode>('off');
  const [page,setPage] = useState(1);
  const [response,setResponse] = useState<MarketplaceReadResponse>(EMPTY_RESPONSE);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState<string | null>(null);
  const [retryKey,setRetryKey] = useState(0);
  const [savedIds,setSavedIds] = useState<Set<string>>(new Set());
  const filtersRef = useRef<HTMLElement | null>(null);
  const requestSequence = useRef(0);

  useEffect(() => {
    if (!auth.session) {
      setSavedIds(new Set());
      return;
    }
    let isMounted = true;
    listMySavedPosts(100, 0)
      .then((res) => {
        if (isMounted) {
          setSavedIds(new Set(res.items.map((i) => i.id)));
        }
      })
      .catch((err) => {
        console.warn('Could not load saved posts', err);
      });
    return () => {
      isMounted = false;
    };
  }, [auth.session]);

  const handleToggleSaved = async (postId: string) => {
    if (!auth.session) {
      navigateLegacy('loginStudent');
      return;
    }
    const isCurrentlySaved = savedIds.has(postId);
    const nextSaved = !isCurrentlySaved;

    setSavedIds((current) => {
      const next = new Set(current);
      if (nextSaved) next.add(postId);
      else next.delete(postId);
      return next;
    });

    try {
      await setPostSaved(postId, nextSaved);
    } catch (err) {
      console.error('Failed to update saved status', err);
      setSavedIds((current) => {
        const next = new Set(current);
        if (isCurrentlySaved) next.add(postId);
        else next.delete(postId);
        return next;
      });
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedKeyword(keyword.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  const query = useMemo(() => ({
    keyword:debouncedKeyword,
    tradeType:filters.tradeType,
    categoryId:filters.categoryId,
    classId:filters.classId,
    sort:filters.sort,
    page,
    pageSize:PAGE_SIZE,
  }), [debouncedKeyword, filters, page]);

  useEffect(() => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setError(null);

    listMarketplacePosts(query)
      .then((next) => {
        if (sequence !== requestSequence.current) return;
        setResponse(next);
        if (next.totalPages > 0 && page > next.totalPages) setPage(next.totalPages);
      })
      .catch((cause:unknown) => {
        if (sequence !== requestSequence.current) return;
        setError(cause instanceof Error ? cause.message : 'Không thể tải chợ học tập.');
      })
      .finally(() => {
        if (sequence === requestSequence.current) setLoading(false);
      });
  }, [query, retryKey, page]);

  const studentClassLabel = useMemo(() => {
    if (filters.classId) {
      return response.classes.find((item) => item.id === filters.classId)?.label ?? null;
    }
    if (auth.profile?.classId) {
      return response.classes.find((item) => item.id === auth.profile?.classId)?.label ?? null;
    }
    return null;
  }, [filters.classId, auth.profile?.classId, response.classes]);

  const view = useMemo(
    () => deriveMarketplacePageState(response, { smartMode, studentClassLabel }),
    [response, smartMode, studentClassLabel],
  );

  const updateFilter = <K extends keyof ServerFilters>(key:K,value:ServerFilters[K]) => {
    setFilters((current) => ({ ...current,[key]:value }));
    setPage(1);
  };

  const updateKeyword = (value:string) => {
    setKeyword(value);
    setPage(1);
  };

  const runHeroSearch = () => {
    updateKeyword(heroKeyword);
    window.setTimeout(() => filtersRef.current?.scrollIntoView({ behavior:'smooth',block:'center' }),0);
  };

  const clearFilters = () => {
    setFilters(INITIAL_FILTERS);
    setSmartMode('off');
    setKeyword('');
    setDebouncedKeyword('');
    setHeroKeyword('');
    setPage(1);
  };

  const toggleSmartMode = (targetMode: Exclude<SmartMode, 'off'>, checked: boolean) => {
    setSmartMode(checked ? targetMode : 'off');
  };

  const changePage = (target:number) => {
    setPage(target);
    if (filtersRef.current) {
      filtersRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      try { window.scrollTo({ top: 380, behavior: 'smooth' }); }
      catch { window.scrollTo(0, 380); }
    }
  };

  return (
    <>
      <StudentHeader activePage="index" />
      <main className="container ecom-page market-page">
        <section className="market-hero">
          <div className="market-hero-copy">
            <span className="eyebrow">CHỢ ĐỒ DÙNG HỌC TẬP</span>
            <h1>Lướt nhanh, tìm đúng món đồ bạn cần</h1>
            <p>Các bài đang hiển thị đều đã qua bước kiểm duyệt và tuân theo phạm vi chia sẻ của trường.</p>
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
          <article className="market-stat-card tone-blue"><div className="market-stat-copy"><span className="market-stat-label">Bài đăng phù hợp</span><strong className="market-stat-value">{view.stats.totalOpen}</strong></div><MarketStatIcon type="list"/></article>
          <article className="market-stat-card tone-green"><div className="market-stat-copy"><span className="market-stat-label">Cho tặng</span><strong className="market-stat-value">{view.stats.free}</strong></div><MarketStatIcon type="gift"/></article>
          <article className="market-stat-card tone-orange"><div className="market-stat-copy"><span className="market-stat-label">Bán giá rẻ</span><strong className="market-stat-value">{view.stats.sale}</strong></div><MarketStatIcon type="tag"/></article>
          <article className="market-stat-card tone-violet"><div className="market-stat-copy"><span className="market-stat-label">Có ảnh minh họa</span><strong className="market-stat-value">{view.stats.hasImage}</strong></div><MarketStatIcon type="image"/></article>
        </section>

        <section ref={filtersRef} className="toolbar market-toolbar market-filter-card" aria-label="Bộ lọc bài đăng">
          <div className="market-filter-head">
            <div className="market-filter-heading">
              <span className="market-filter-heading-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M4 7h10M18 7h2M4 17h2M10 17h10M8 4v6M8 14v6M16 4v6M16 14v6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/></svg></span>
              <span>Bộ lọc tìm kiếm</span>
            </div>
            <button className="market-clear-filter" type="button" onClick={clearFilters}>Xóa bộ lọc</button>
          </div>

          <div className="market-filter-main">
            <div className="market-filter-search">
              <span aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8"/><path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg></span>
              <input aria-label="Tìm kiếm bài đăng" value={keyword} onChange={(event)=>updateKeyword(event.target.value)} placeholder="Tìm theo tiêu đề hoặc mô tả..." />
            </div>
            <select aria-label="Lọc theo hình thức" value={filters.tradeType} onChange={(event)=>updateFilter('tradeType',event.target.value as ''|TradeType)}>
              <option value="">Tất cả loại hình</option>{TRADE_TYPES.map((type)=><option key={type} value={type}>{type}</option>)}
            </select>
            <select aria-label="Lọc theo danh mục" value={filters.categoryId} onChange={(event)=>updateFilter('categoryId',event.target.value)}>
              <option value="">Tất cả danh mục</option>{view.categories.map((category)=><option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
            <select aria-label="Lọc theo lớp" value={filters.classId} onChange={(event)=>updateFilter('classId',event.target.value)}>
              <option value="">Tất cả lớp học</option>{view.classes.map((classItem)=><option key={classItem.id} value={classItem.id}>{classItem.label}</option>)}
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
            <div className="market-smart-switches" role="group" aria-label="Tùy chọn xếp hạng uy tín và gợi ý AI">
              <label className={`market-switch-control${smartMode === 'rank' ? ' is-active' : ''}`}>
                <span className="market-switch-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                </span>
                <span>Bật xếp hạng theo uy tín</span>
                <input
                  type="checkbox"
                  aria-label="Bật xếp hạng theo uy tín"
                  checked={smartMode === 'rank'}
                  onChange={(event) => toggleSmartMode('rank', event.target.checked)}
                />
                <span className="market-switch" aria-hidden="true" />
              </label>
              <span className="market-switch-separator" aria-hidden="true" />
              <label className={`market-switch-control market-switch-control-ai${smartMode === 'ai' ? ' is-active' : ''}`}>
                <span className="market-switch-icon market-spark" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
                    <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z" />
                  </svg>
                </span>
                <span>Bật gợi ý AI</span>
                <input
                  type="checkbox"
                  aria-label="Bật gợi ý AI"
                  checked={smartMode === 'ai'}
                  onChange={(event) => toggleSmartMode('ai', event.target.checked)}
                />
                <span className="market-switch" aria-hidden="true" />
              </label>
            </div>
          </div>
        </section>

        {!loading && !error && smartMode !== 'off' ? (
          <MarketplaceSmartStrip
            posts={view.smartPosts}
            mode={smartMode}
            filteredCount={view.totalCount}
            studentClassLabel={studentClassLabel}
            onModeChange={setSmartMode}
          />
        ) : null}

        <div className="listing-title">
          <div><span className="eyebrow">SẢN PHẨM ĐANG MỞ</span><h2>Khám phá đồ dùng học tập</h2></div>
          <button className="btn primary" type="button" onClick={()=>navigateLegacy('add')}>+ Đăng bài</button>
        </div>

        <section className="post-grid" aria-busy={loading}>
          {loading ? (
            <div style={{ gridColumn: '1 / -1' }}>
              <StickerLoader message="Đang tải sàn đồ dùng học tập..." subtext="Edu Share+ • Chia sẻ đồ dùng học tập an toàn" />
            </div>
          ) : null}
          {!loading && error ? (
            <div className="state" style={{ gridColumn: '1 / -1', padding: '36px 20px', textAlign: 'center', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #fee2e2' }}>
              <div style={{ width: '48px', height: '48px', margin: '0 auto 14px', borderRadius: '50%', backgroundColor: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>
                {error.includes('EDU_SHARE_MARKETPLACE_ACCESS_DENIED') ? 'Chưa thể truy cập Chợ học tập' : 'Không thể tải dữ liệu'}
              </h3>
              <p style={{ fontSize: '14px', color: '#4b5563', maxWidth: '540px', margin: '0 auto 20px', lineHeight: '1.55' }}>
                {error.includes('EDU_SHARE_MARKETPLACE_ACCESS_DENIED')
                  ? 'Chợ học tập chỉ dành cho học sinh đã đối chiếu danh sách trường hoặc Thầy/Cô quản trị viên. Nếu bạn là Giáo viên, bạn có thể chuyển ngay sang Cổng Quản trị để duyệt bài và đối chiếu tài khoản.'
                  : error}
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="btn primary" type="button" onClick={() => setRetryKey((value) => value + 1)}>
                  Thử lại
                </button>
                <button
                  className="btn light"
                  type="button"
                  onClick={() => navigateLegacy('admin')}
                  style={{ border: '1px solid #fca5a5', color: '#dc2626', backgroundColor: '#fef2f2', fontWeight: 650 }}
                >
                  Vào trang Quản trị giáo viên
                </button>
                <button
                  className="btn light"
                  type="button"
                  onClick={() => navigateLegacy('profile')}
                  style={{ border: '1px solid #d1d5db', color: '#374151', fontWeight: 600 }}
                >
                  Xem hồ sơ tài khoản
                </button>
              </div>
            </div>
          ) : null}
          {!loading && !error && view.posts.length ? view.posts.map((post)=><MarketplacePostCard key={post.id} post={post} saved={savedIds.has(post.id)} onToggleSaved={()=>void handleToggleSaved(post.id)}/>) : null}
          {!loading && !error && !view.posts.length ? <div className="state">Chưa có bài đăng phù hợp.</div> : null}
        </section>

        {!loading && !error ? <MarketplacePagination totalPages={view.totalPages} safePage={view.safePage} filteredCount={view.totalCount} onChange={changePage} /> : null}
      </main>
      <footer className="page-footer">Edu Share+ • Chia sẻ đồ dùng học tập an toàn trong mạng lưới trường học</footer>
    </>
  );
}
