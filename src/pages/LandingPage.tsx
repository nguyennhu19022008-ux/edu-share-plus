import { useState } from 'react';
import { navigateLegacy } from '../app/legacyRouter';

function BouncyText({
  text,
  className,
  baseDelayMs = 200,
}: {
  text: string;
  className?: string;
  baseDelayMs?: number;
}) {
  let charCounter = 0;
  const words = text.split(' ');

  return (
    <span className={`landing-bouncy-heading ${className ?? ''}`} aria-label={text}>
      {words.map((word, wIdx) => (
        <span key={wIdx} style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
          {Array.from(word).map((char) => {
            const currentDelay = baseDelayMs + charCounter * 26;
            charCounter++;
            return (
              <span
                key={charCounter}
                className="landing-bouncy-letter"
                style={{ animationDelay: `${currentDelay}ms` }}
                aria-hidden="true"
              >
                {char}
              </span>
            );
          })}
          {wIdx < words.length - 1 ? '\u00A0' : ''}
        </span>
      ))}
    </span>
  );
}

export default function LandingPage() {
  const [search, setSearch] = useState('');
  const startMarketplaceSearch = (prefill?: string) => {
    const keyword = String(prefill ?? search).trim();
    if (prefill !== undefined) setSearch(keyword);
    navigateLegacy('loginStudent', keyword ? { search: keyword } : {});
  };

  return (
    <>
      <div className="promo-strip landing-v2-promo" role="status">
        <span>
          <svg
            style={{ width: '15px', height: '15px', display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m4.5 16.5-1.5 3 3-1.5L8.5 16 8 13.5l-2-2L4.5 16.5z" />
            <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
            <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
            <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
          </svg>
          Tuần lễ trao đổi sách giáo khoa 0 đồng! Các món đồ học tập đang sẵn sàng.
        </span>
      </div>

      <nav className="landing-nav landing-v2-nav" aria-label="Điều hướng Landing Page">
        <div className="landing-v2-nav-inner">
          <button className="landing-v2-brand" type="button" onClick={() => navigateLegacy('landing')} aria-label="Về trang Edu Share+">
            <span className="landing-v2-brand-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false"><path d="M7 8V6a5 5 0 0 1 10 0v2h2.25A1.75 1.75 0 0 1 21 9.75v9.5A1.75 1.75 0 0 1 19.25 21H4.75A1.75 1.75 0 0 1 3 19.25v-9.5A1.75 1.75 0 0 1 4.75 8H7Zm2 0h6V6a3 3 0 0 0-6 0v2Zm1 4a1 1 0 0 0-2 0v2a1 1 0 1 0 2 0v-2Zm6 0a1 1 0 0 0-2 0v2a1 1 0 1 0 2 0v-2Z" /></svg>
            </span>
            <span className="landing-v2-brand-name">Edu Share<span>+</span></span>
          </button>

          <div className="landing-v2-menu" aria-label="Các phần nội dung">
            <a href="#about">About</a>
            <a href="#process">Process</a>
            <a href="#policy">Policy</a>
            <a href="#community">Community</a>
          </div>

          <div className="landing-v2-actions">
            <button className="landing-v2-btn landing-v2-btn-admin" type="button" onClick={() => navigateLegacy('loginGV')}>Quản trị viên</button>
            <button className="landing-v2-btn landing-v2-btn-outline" type="button" onClick={() => navigateLegacy('loginStudent')}>Đăng nhập</button>
            <button className="landing-v2-btn landing-v2-btn-primary" type="button" onClick={() => navigateLegacy('registerStudent')}>Tạo tài khoản</button>
          </div>
        </div>
      </nav>

      <main className="landing-v2-main">
        <section className="landing-v2-section landing-v2-about reveal-section visible" id="about" aria-labelledby="landingHeroTitle">
          <div className="landing-v2-hero-grid">
            <div className="landing-v2-hero-copy">
              <span className="landing-v2-kicker">
                <svg style={{ width: '13px', height: '13px' }} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12.01 2.25c.37 0 .7.24.82.59 1.15 3.39 3.96 6.2 7.35 7.35.35.12.59.45.59.82 0 .37-.24.7-.59.82-3.39 1.15-6.2 3.96-7.35 7.35-.12.35-.45.59-.82.59-.37 0-.7-.24-.82-.59-1.15-3.39-3.96-6.2-7.35-7.35-.35-.12-.59-.45-.59-.82 0-.37.24-.7.59-.82 3.39-1.15 6.2-3.96 7.35-7.35.12-.35.45-.59.82-.59z" />
                </svg>
                Sàn trao đổi đồ dùng học tập học đường
              </span>

              <h1 id="landingHeroTitle">
                <BouncyText text="Cũ với bạn, " baseDelayMs={250} />
                <BouncyText
                  text="hữu ích với người khác!"
                  className="landing-gradient-text"
                  baseDelayMs={540}
                />
              </h1>

              <p className="landing-zoom-desc" style={{ animationDelay: '650ms' }}>
                Cho mượn, cho tặng, trao đổi hoặc bán giá rẻ sách vở và đồ dùng học tập. Mỗi bài đăng đều được kiểm duyệt trước khi xuất hiện trên sàn.
              </p>

              <div className="landing-v2-search landing-stagger-item landing-from-left" style={{ animationDelay: '800ms' }} role="search">
                <span className="landing-v2-search-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false"><path d="m21 20-4.35-4.35a8 8 0 1 0-1.41 1.41L19.59 21 21 20ZM5 11a6 6 0 1 1 12 0 6 6 0 0 1-12 0Z" /></svg>
                </span>
                <input value={search} onChange={(event) => setSearch(event.target.value)} type="search" autoComplete="off" placeholder="Tìm máy tính Casio, SGK 12, đồ vẽ kỹ thuật..." onKeyDown={(event) => { if (event.key === 'Enter') startMarketplaceSearch(); }} />
                <button type="button" onClick={() => startMarketplaceSearch()}>Tìm kiếm</button>
              </div>

              <div className="landing-v2-hot-search landing-stagger-item landing-from-left" style={{ animationDelay: '950ms' }} aria-label="Từ khóa tìm kiếm gợi ý">
                <b>Tìm kiếm HOT:</b>
                <button type="button" onClick={() => startMarketplaceSearch('Casio 570')}>Casio 570</button>
                <button type="button" onClick={() => startMarketplaceSearch('Sách giáo khoa')}>Sách giáo khoa</button>
                <button type="button" onClick={() => startMarketplaceSearch('Đồng phục')}>Đồng phục</button>
              </div>
            </div>

            <aside className="landing-v2-promo-card" aria-label="Ưu điểm nổi bật">
              <div className="landing-beam-wrap" aria-hidden="true">
                <svg className="landing-beam-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <rect className="landing-beam-runner" x="1" y="1" width="98" height="98" rx="4" pathLength="100" />
                </svg>
              </div>
              <span className="landing-v2-promo-badge">Đặc quyền học sinh</span>
              <h2>Đổi đồ<br />0 đồng</h2>
              <p>Đồ dùng học tập được chia sẻ trực tiếp trong cộng đồng trường học, minh bạch và có kiểm duyệt.</p>
              <div className="landing-v2-promo-metrics">
                <div><strong>100%</strong><span>Giáo viên duyệt</span></div>
                <div><strong>0 VNĐ</strong><span>Phí dịch vụ sàn</span></div>
              </div>
            </aside>
          </div>

          <div className="landing-v2-about-points">
            <article className="landing-stagger-item landing-from-left" style={{ animationDelay: '900ms' }}>
              <span aria-hidden="true">
                <svg className="landing-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 19H4.815a1.83 1.83 0 0 1-1.57-.881 1.785 1.785 0 0 1-.004-1.784L7.196 9.5"/><path d="M11 19h8.2a1.8 1.8 0 0 0 1.58-.88 1.8 1.8 0 0 0 0-1.79L18 11.5"/><path d="m14 14 3-3 3 3"/><path d="m3 7 3-3 3 3"/><path d="M6 4v7a4 4 0 0 0 4 4h4"/></svg>
              </span>
              <div><h3>Tái sử dụng thông minh</h3><p>Đưa sách và đồ dùng còn tốt đến đúng người đang cần.</p></div>
            </article>
            <article className="landing-stagger-item landing-from-right" style={{ animationDelay: '1050ms' }}>
              <span aria-hidden="true">
                <svg className="landing-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2V5z"/><path d="M2 9v1c0 1.1.9 2 2 2h1"/><path d="M16 11h.01"/></svg>
              </span>
              <div><h3>Tiết kiệm chi phí</h3><p>Ưu tiên cho tặng, cho mượn, trao đổi và bán giá phù hợp học sinh.</p></div>
            </article>
            <article className="landing-stagger-item landing-from-left" style={{ animationDelay: '1200ms' }}>
              <span aria-hidden="true">
                <svg className="landing-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
              </span>
              <div><h3>An toàn trong trường</h3><p>Nội dung được kiểm duyệt và có công cụ báo cáo, quản lý quyền riêng tư.</p></div>
            </article>
          </div>
        </section>

        <section className="landing-v2-section reveal-section visible" id="process" aria-labelledby="processTitle">
          <div className="landing-v2-section-heading">
            <span>Process</span>
            <h2 id="processTitle">
              <BouncyText text="Quy trình mượn, đổi trong bốn bước" baseDelayMs={150} />
            </h2>
            <p className="landing-zoom-desc" style={{ animationDelay: '300ms' }}>
              Mỗi bước được thiết kế rõ ràng để học sinh dễ đăng bài, tìm món đồ và trao đổi an toàn.
            </p>
          </div>
          <div className="landing-v2-process-card">
            <article className="landing-stagger-item landing-from-left" style={{ animationDelay: '200ms' }}><i>1</i><div><h3>Đăng nhập</h3><p>Sử dụng tài khoản học sinh đã đăng ký.</p></div></article>
            <article className="landing-stagger-item landing-from-right" style={{ animationDelay: '350ms' }}><i>2</i><div><h3>Đăng hoặc tìm đồ</h3><p>Lựa chọn hình thức và danh mục phù hợp.</p></div></article>
            <article className="landing-stagger-item landing-from-left" style={{ animationDelay: '500ms' }}><i>3</i><div><h3>Giáo viên duyệt</h3><p>Bài hợp lệ mới xuất hiện công khai trên sàn.</p></div></article>
            <article className="landing-stagger-item landing-from-right" style={{ animationDelay: '650ms' }}><i>4</i><div><h3>Trao đổi tại trường</h3><p>Ưu tiên gặp trực tiếp ở nơi an toàn, có giám sát.</p></div></article>
          </div>
        </section>

        <section className="landing-v2-section reveal-section visible" id="policy" aria-labelledby="policyTitle">
          <div className="landing-v2-policy-shell">
            <div className="landing-v2-policy-intro">
              <span className="landing-v2-kicker">
                <svg style={{ width: '13px', height: '13px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Policy
              </span>
              <h2 id="policyTitle">
                <BouncyText text="Chính sách được thiết kế cho môi trường học đường" baseDelayMs={150} />
              </h2>
              <p className="landing-zoom-desc" style={{ animationDelay: '300ms' }}>
                Edu Share+ ưu tiên quyền riêng tư, kiểm duyệt nội dung và khả năng truy vết hoạt động để mọi trao đổi diễn ra có trách nhiệm.
              </p>
              <button className="landing-v2-btn landing-v2-btn-primary" type="button" onClick={() => navigateLegacy('registerStudent')}>Tham gia cộng đồng</button>
            </div>
            <div className="landing-v2-policy-grid">
              <article className="landing-stagger-item landing-from-left" style={{ animationDelay: '200ms' }}><b>01</b><h3>Kiểm duyệt trước khi đăng</h3><p>Bài mới phải được giáo viên duyệt trước khi xuất hiện trên trang chủ.</p></article>
              <article className="landing-stagger-item landing-from-right" style={{ animationDelay: '350ms' }}><b>02</b><h3>Che thông tin liên hệ</h3><p>Email và số điện thoại được bảo vệ theo thiết lập quyền riêng tư của học sinh.</p></article>
              <article className="landing-stagger-item landing-from-left" style={{ animationDelay: '500ms' }}><b>03</b><h3>Báo cáo nội dung</h3><p>Người dùng có thể báo cáo bài đăng và bình luận không phù hợp.</p></article>
              <article className="landing-stagger-item landing-from-right" style={{ animationDelay: '650ms' }}><b>04</b><h3>Nhật ký hoạt động</h3><p>Các thao tác quan trọng được ghi nhận để giáo viên có thể kiểm tra khi cần.</p></article>
            </div>
          </div>
        </section>

        <section className="landing-v2-section reveal-section visible" id="community" aria-labelledby="communityTitle">
          <div className="landing-v2-section-heading landing-v2-community-heading">
            <div>
              <span>Community</span>
              <h2 id="communityTitle">
                <BouncyText text="Cộng đồng Edu Share+" baseDelayMs={150} />
              </h2>
              <p className="landing-zoom-desc" style={{ animationDelay: '300ms' }}>
                Các con số bên dưới được lấy trực tiếp từ dữ liệu đang hoạt động của hệ thống.
              </p>
            </div>
            <button className="landing-v2-community-link" type="button" onClick={() => navigateLegacy('loginStudent')}>Xem tất cả ›</button>
          </div>

          <div className="landing-v2-community-stats" aria-label="Thống kê cộng đồng">
            <article className="landing-stagger-item landing-from-left" style={{ animationDelay: '150ms' }}><span>Học sinh tham gia</span><strong>—</strong><small>Tài khoản đang hoạt động</small></article>
            <article className="landing-stagger-item landing-from-right" style={{ animationDelay: '300ms' }}><span>Bài đang mở</span><strong>—</strong><small>Có thể tìm kiếm trên sàn</small></article>
            <article className="landing-stagger-item landing-from-left" style={{ animationDelay: '450ms' }}><span>Đã hoàn thành</span><strong>—</strong><small>Giao dịch được lưu trữ</small></article>
            <article className="landing-stagger-item landing-from-right" style={{ animationDelay: '600ms' }}><span>Tổng bài đã đăng</span><strong>—</strong><small>Gồm các trạng thái hiện có</small></article>
          </div>

          <div className="landing-v2-product-title"><span></span><h3>Món đồ mới lên kệ</h3></div>
          <div className="landing-v2-product-grid" aria-live="polite">
            <div className="landing-v2-product-skeleton"></div>
            <div className="landing-v2-product-skeleton"></div>
            <div className="landing-v2-product-skeleton"></div>
            <div className="landing-v2-product-skeleton"></div>
          </div>
        </section>
      </main>

      <footer className="landing-v2-footer">
        <strong>Edu Share+</strong>
        <span>Nền tảng chia sẻ và trao đổi đồ dùng học tập an toàn trong nhà trường.</span>
      </footer>
    </>
  );
}

