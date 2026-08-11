import { useState } from 'react';
import { navigateLegacy } from '../app/legacyRouter';

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
        <span>🚀 Tuần lễ trao đổi sách giáo khoa 0 đồng! Các món đồ học tập đang sẵn sàng.</span>
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
              <span className="landing-v2-kicker"><span aria-hidden="true">🔥</span> Sàn trao đổi đồ dùng học tập học đường</span>
              <h1 id="landingHeroTitle">Cũ với bạn, <span>hữu ích với người khác!</span></h1>
              <p>Cho mượn, cho tặng, trao đổi hoặc bán giá rẻ sách vở và đồ dùng học tập. Mỗi bài đăng đều được kiểm duyệt trước khi xuất hiện trên sàn.</p>

              <div className="landing-v2-search" role="search">
                <span className="landing-v2-search-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false"><path d="m21 20-4.35-4.35a8 8 0 1 0-1.41 1.41L19.59 21 21 20ZM5 11a6 6 0 1 1 12 0 6 6 0 0 1-12 0Z" /></svg>
                </span>
                <input value={search} onChange={(event) => setSearch(event.target.value)} type="search" autoComplete="off" placeholder="Tìm máy tính Casio, SGK 12, đồ vẽ kỹ thuật..." onKeyDown={(event) => { if (event.key === 'Enter') startMarketplaceSearch(); }} />
                <button type="button" onClick={() => startMarketplaceSearch()}>Tìm kiếm</button>
              </div>

              <div className="landing-v2-hot-search" aria-label="Từ khóa tìm kiếm gợi ý">
                <b>Tìm kiếm HOT:</b>
                <button type="button" onClick={() => startMarketplaceSearch('Casio 570')}>Casio 570</button>
                <button type="button" onClick={() => startMarketplaceSearch('Sách giáo khoa')}>Sách giáo khoa</button>
                <button type="button" onClick={() => startMarketplaceSearch('Đồng phục')}>Đồng phục</button>
              </div>
            </div>

            <aside className="landing-v2-promo-card" aria-label="Ưu điểm nổi bật">
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
            <article><span aria-hidden="true">♻</span><div><h3>Tái sử dụng thông minh</h3><p>Đưa sách và đồ dùng còn tốt đến đúng người đang cần.</p></div></article>
            <article><span aria-hidden="true">💰</span><div><h3>Tiết kiệm chi phí</h3><p>Ưu tiên cho tặng, cho mượn, trao đổi và bán giá phù hợp học sinh.</p></div></article>
            <article><span aria-hidden="true">🛡</span><div><h3>An toàn trong trường</h3><p>Nội dung được kiểm duyệt và có công cụ báo cáo, quản lý quyền riêng tư.</p></div></article>
          </div>
        </section>

        <section className="landing-v2-section reveal-section visible" id="process" aria-labelledby="processTitle">
          <div className="landing-v2-section-heading">
            <span>Process</span>
            <h2 id="processTitle">Quy trình mượn, đổi trong bốn bước</h2>
            <p>Mỗi bước được thiết kế rõ ràng để học sinh dễ đăng bài, tìm món đồ và trao đổi an toàn.</p>
          </div>
          <div className="landing-v2-process-card">
            <article><i>1</i><div><h3>Đăng nhập</h3><p>Sử dụng tài khoản học sinh đã đăng ký.</p></div></article>
            <article><i>2</i><div><h3>Đăng hoặc tìm đồ</h3><p>Lựa chọn hình thức và danh mục phù hợp.</p></div></article>
            <article><i>3</i><div><h3>Giáo viên duyệt</h3><p>Bài hợp lệ mới xuất hiện công khai trên sàn.</p></div></article>
            <article><i>4</i><div><h3>Trao đổi tại trường</h3><p>Ưu tiên gặp trực tiếp ở nơi an toàn, có giám sát.</p></div></article>
          </div>
        </section>

        <section className="landing-v2-section reveal-section visible" id="policy" aria-labelledby="policyTitle">
          <div className="landing-v2-policy-shell">
            <div className="landing-v2-policy-intro">
              <span className="landing-v2-kicker"><span aria-hidden="true">🛡</span> Policy</span>
              <h2 id="policyTitle">Chính sách được thiết kế cho môi trường học đường</h2>
              <p>Edu Share+ ưu tiên quyền riêng tư, kiểm duyệt nội dung và khả năng truy vết hoạt động để mọi trao đổi diễn ra có trách nhiệm.</p>
              <button className="landing-v2-btn landing-v2-btn-primary" type="button" onClick={() => navigateLegacy('registerStudent')}>Tham gia cộng đồng</button>
            </div>
            <div className="landing-v2-policy-grid">
              <article><b>01</b><h3>Kiểm duyệt trước khi đăng</h3><p>Bài mới phải được giáo viên duyệt trước khi xuất hiện trên trang chủ.</p></article>
              <article><b>02</b><h3>Che thông tin liên hệ</h3><p>Email và số điện thoại được bảo vệ theo thiết lập quyền riêng tư của học sinh.</p></article>
              <article><b>03</b><h3>Báo cáo nội dung</h3><p>Người dùng có thể báo cáo bài đăng và bình luận không phù hợp.</p></article>
              <article><b>04</b><h3>Nhật ký hoạt động</h3><p>Các thao tác quan trọng được ghi nhận để giáo viên có thể kiểm tra khi cần.</p></article>
            </div>
          </div>
        </section>

        <section className="landing-v2-section reveal-section visible" id="community" aria-labelledby="communityTitle">
          <div className="landing-v2-section-heading landing-v2-community-heading">
            <div>
              <span>Community</span>
              <h2 id="communityTitle">Cộng đồng Edu Share+</h2>
              <p>Các con số bên dưới được lấy trực tiếp từ dữ liệu đang hoạt động của hệ thống.</p>
            </div>
            <button className="landing-v2-community-link" type="button" onClick={() => navigateLegacy('loginStudent')}>Xem tất cả ›</button>
          </div>

          <div className="landing-v2-community-stats" aria-label="Thống kê cộng đồng">
            <article><span>Học sinh tham gia</span><strong>—</strong><small>Tài khoản đang hoạt động</small></article>
            <article><span>Bài đang mở</span><strong>—</strong><small>Có thể tìm kiếm trên sàn</small></article>
            <article><span>Đã hoàn thành</span><strong>—</strong><small>Giao dịch được lưu trữ</small></article>
            <article><span>Tổng bài đã đăng</span><strong>—</strong><small>Gồm các trạng thái hiện có</small></article>
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
