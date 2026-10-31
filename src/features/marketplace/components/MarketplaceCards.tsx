import { navigateLegacy } from '../../../app/legacyRouter';
import type { MarketPost, MarketPostDisplay, SmartMode } from '../types';
import {
  formatMarketCardDate,
  formatMarketMoney,
  marketReputationTone,
  marketTradeClass,
  normalizeMarketReputationScore,
} from '../viewUtils';

export function MarketStatIcon({ type }: { type:'list'|'gift'|'tag'|'image' }) {
  const icons = {
    list:<svg viewBox="0 0 24 24" fill="none"><path d="M9 6h11M9 12h11M9 18h11" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/><path d="m4 6 1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    gift:<svg viewBox="0 0 24 24" fill="none"><path d="M4 10h16v10H4V10Zm-1-4h18v4H3V6Zm9 0v14" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M12 6H8.7A2.2 2.2 0 1 1 11 3.8L12 6Zm0 0h3.3A2.2 2.2 0 1 0 13 3.8L12 6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>,
    tag:<svg viewBox="0 0 24 24" fill="none"><path d="M20 13 13 20l-9-9V4h7l9 9Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><circle cx="8.5" cy="8.5" r="1.4" fill="currentColor"/></svg>,
    image:<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8"/><circle cx="8.5" cy="9" r="1.5" stroke="currentColor" strokeWidth="1.6"/><path d="m5 18 4.2-4.2 3 3 2.3-2.3L19 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  };
  return <span className="market-stat-icon" aria-hidden="true">{icons[type]}</span>;
}

export function MarketplaceSmartStrip({
  posts,
  mode,
  filteredCount,
  studentClassLabel,
  onModeChange,
}: {
  posts: MarketPost[];
  mode: Exclude<SmartMode, 'off'>;
  filteredCount: number;
  studentClassLabel?: string | null;
  onModeChange?: (nextMode: SmartMode) => void;
}) {
  const isAi = mode === 'ai';
  return (
    <section
      className="v26-feed-section"
      aria-label={isAi ? 'Gợi ý AI trong kết quả đang lọc' : 'Bảng xếp hạng uy tín trong kết quả đang lọc'}
    >
      <div className="v26-feed-head">
        <div className="v26-feed-head-copy">
          <span className="v26-feed-eyebrow">
            {isAi ? 'ĐỘNG CƠ GỢI Ý AI HỌC ĐƯỜNG • PHASE 6' : 'BẢNG XẾP HẠNG TÍN NHIỆM HỌC ĐƯỜNG • PHASE 6'}
          </span>
          <h2>
            {isAi
              ? `AI gợi ý học liệu phù hợp${studentClassLabel ? ` cho Lớp ${studentClassLabel}` : ''}`
              : 'Xếp hạng theo điểm uy tín & mức độ tin cậy'}
          </h2>
          <div className="subtext">
            {isAi
              ? 'Ưu tiên học liệu khớp chương trình khối lớp, sách tặng 0 đồng và thiết bị học tập thiết yếu trong kết quả đang lọc.'
              : 'Xếp hạng dựa trên điểm uy tín chủ bài đã xác thực, danh hiệu chia sẻ, lượt lưu và minh chứng ảnh thực tế.'}
            {' '}• Đang phân tích {posts.length}/{filteredCount} bài phù hợp.
          </div>
        </div>
        <div className="v26-feed-actions">
          <span className="ai-badge">
            {isAi ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
                <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            )}
            <span>{isAi ? 'AI đề xuất' : 'Xếp hạng uy tín'}</span>
          </span>
          {onModeChange ? (
            <div className="v26-mode-pills" role="group" aria-label="Chuyển nhanh chế độ thông minh">
              <button
                type="button"
                className={`v26-mode-pill${!isAi ? ' active' : ''}`}
                onClick={() => onModeChange('rank')}
              >
                Uy tín
              </button>
              <button
                type="button"
                className={`v26-mode-pill${isAi ? ' active' : ''}`}
                onClick={() => onModeChange('ai')}
              >
                Gợi ý AI
              </button>
              <button
                type="button"
                className="v26-mode-pill close"
                onClick={() => onModeChange('off')}
                title="Tắt chế độ thông minh"
              >
                Tắt
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {posts.length ? (
        <div className="v26-strip">
          {posts.slice(0, 6).map((post, index) => {
            const repScore = normalizeMarketReputationScore(post.ownerReputationScore);
            const repText = Number.isInteger(repScore) ? String(repScore) : repScore.toFixed(1);
            const badgeTag = isAi
              ? post.explanationTag || 'Gợi ý phù hợp'
              : post.reputationBadgeLabel || post.ownerReputationLabel || 'Thành viên tích cực';
            const classDisplay =
              !post.className || post.className === 'Không công khai'
                ? 'Không công khai lớp'
                : `Lớp ${post.className}`;

            return (
              <article className="v26-mini-card" key={post.id}>
                <div className="v26-mini-top">
                  <span className="v26-rank-index">#{String(index + 1).padStart(2, '0')}</span>
                  <span className="v26-smart-tag">{badgeTag}</span>
                  <strong className="v26-mini-price">
                    {post.price > 0 ? formatMarketMoney(post.price) : '0 ₫'}
                  </strong>
                </div>
                <div className="v26-mini-title">{post.title}</div>
                <div className="tags">
                  <span className={`market-product-tag ${marketTradeClass(post.tradeType)}`}>{post.tradeType}</span>
                  <span className="market-product-tag category">{post.category}</span>
                </div>
                <div className="meta">
                  {post.name} • {classDisplay} • Uy tín {repText}/10
                </div>
                <div className="v26-rank-line">
                  <span>
                    {isAi ? 'Điểm AI' : 'Điểm xếp hạng'}: {isAi ? post.aiScore : post.rankScore}/100
                  </span>
                  <span className="v26-fav-stat">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M7 4.5A2.5 2.5 0 0 1 9.5 2h5A2.5 2.5 0 0 1 17 4.5V21l-5-3.4L7 21V4.5Z" />
                    </svg>
                    {post.favoriteCount} lượt lưu
                  </span>
                </div>
                <div className="muted v26-reason">{post.recommendationReason}</div>
                <button
                  className="btn small primary v26-detail-btn"
                  type="button"
                  onClick={() => navigateLegacy('detail', { id: post.id })}
                >
                  Xem chi tiết
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="state v26-empty-state">
          Chưa có bài đăng phù hợp để {isAi ? 'gợi ý AI' : 'xếp hạng uy tín'} trong bộ lọc hiện tại.
        </div>
      )}
    </section>
  );
}

export function MarketplacePostCard({ post, saved, onToggleSaved }: { post:MarketPostDisplay; saved:boolean; onToggleSaved:()=>void }) {
  const score = normalizeMarketReputationScore(post.ownerReputationScore);
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
