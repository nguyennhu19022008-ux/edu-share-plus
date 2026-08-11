import { navigateLegacy } from '../../../app/legacyRouter';
import type { MarketPost, SmartMode } from '../types';
import { formatMarketCardDate, formatMarketMoney, marketReputationTone, marketTradeClass } from '../viewUtils';

export function MarketStatIcon({ type }: { type:'list'|'gift'|'tag'|'image' }) {
  const icons = {
    list:<svg viewBox="0 0 24 24" fill="none"><path d="M9 6h11M9 12h11M9 18h11" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/><path d="m4 6 1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    gift:<svg viewBox="0 0 24 24" fill="none"><path d="M4 10h16v10H4V10Zm-1-4h18v4H3V6Zm9 0v14" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M12 6H8.7A2.2 2.2 0 1 1 11 3.8L12 6Zm0 0h3.3A2.2 2.2 0 1 0 13 3.8L12 6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>,
    tag:<svg viewBox="0 0 24 24" fill="none"><path d="M20 13 13 20l-9-9V4h7l9 9Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><circle cx="8.5" cy="8.5" r="1.4" fill="currentColor"/></svg>,
    image:<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8"/><circle cx="8.5" cy="9" r="1.5" stroke="currentColor" strokeWidth="1.6"/><path d="m5 18 4.2-4.2 3 3 2.3-2.3L19 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  };
  return <span className="market-stat-icon" aria-hidden="true">{icons[type]}</span>;
}

export function MarketplaceSmartStrip({ posts, mode, filteredCount }: { posts:MarketPost[]; mode:Exclude<SmartMode,'off'>; filteredCount:number }) {
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

export function MarketplacePostCard({ post, saved, onToggleSaved }: { post:MarketPost; saved:boolean; onToggleSaved:()=>void }) {
  const score = Math.max(0, Math.min(10, post.ownerReputationScore));
  return (
    <article className="post-card market-product-card">
      <div className="market-product-card-body">
        <div className="market-product-card-top">
          <div className="market-product-card-tags">
            <span className={`market-product-tag ${marketTradeClass(post.tradeType)}`}>{post.tradeType}</span>
            <span className="market-product-tag category">{post.category}</span>
          </div>
          {post.price > 0 ? <strong className="market-product-price">{formatMarketMoney(post.price)}</strong> : null}
        </div>
        <h3 className="market-product-title">{post.title}</h3>
        <div className={`market-product-reputation ${marketReputationTone(score)}`}>
          <span>Mức độ uy tín</span>
          <strong>{Number.isInteger(score) ? score : score.toFixed(1)}/10{post.ownerReputationLabel ? ` (${post.ownerReputationLabel})` : ''}</strong>
        </div>
        <div className="market-product-card-footer">
          <div className="market-product-owner">
            <strong>{post.name}{post.className ? ` - ${post.className}` : ''}</strong>
            <span>Đăng lúc: {formatMarketCardDate(post.date)}</span>
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
