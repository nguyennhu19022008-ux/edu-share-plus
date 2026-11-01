import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import LandingPage, { SHOWCASE_ITEMS, ShowcaseDetailModal } from '../src/pages/LandingPage';
import {
  estimateItemImpact,
  IMPACT_BENCHMARKS,
  formatVnd,
} from '../src/features/transactions/impactCalculator';

test('LandingPage renders completely with Style 4 Architectural Bento structure', () => {
  const html = renderToStaticMarkup(<LandingPage />);

  // 1. Institutional Top Bar
  assert.ok(html.includes('DỰ ÁN KHKT LĨNH VỰC HÀNH VI (BEHA)'));
  assert.ok(html.includes('MÔ HÌNH KINH TẾ TUẦN HOÀN HỌC ĐƯỜNG'));
  assert.ok(html.includes('100% Bài đăng kiểm duyệt bởi Giáo viên'));

  // 2. Navigation
  assert.ok(html.includes('Edu Share'));
  assert.ok(html.includes('Quản trị viên'));
  assert.ok(html.includes('Đăng nhập'));
  assert.ok(html.includes('Tạo tài khoản'));

  // 3. Hero Split Architecture & Semantic Search Form
  assert.ok(html.includes('SÀN CHIA SẺ &amp; TÁI SỬ DỤNG HỌC LIỆU CÓ KIỂM DUYỆT'));
  assert.ok(html.includes('Cũ với bạn,'));
  assert.ok(html.includes('hữu ích với người khác.'));
  assert.ok(html.includes('Casio fx-580VN X'));
  assert.ok(html.includes('SGK Lớp 12 GDPT 2018'));
  assert.ok(html.includes('<form class="lp-search-bar" role="search"'));
  assert.ok(html.includes('type="submit"'));

  // 4. Empirical Ledger Matrix
  assert.ok(html.includes('83,66%'));
  assert.ok(html.includes('+16,22%'));
  assert.ok(html.includes('100%'));
  assert.ok(html.includes('0 VNĐ'));

  // 5. Gapless Bento Matrix & Circular Impact Simulator with Interactive Range Slider
  assert.ok(html.includes('MÔ HÌNH TOÁN HỌC &amp; BẢO MẬT HỌC ĐƯỜNG'));
  assert.ok(html.includes('Máy Tính Tác Động Kinh Tế &amp; Môi Trường'));
  assert.ok(html.includes('Sách giáo khoa'));
  assert.ok(html.includes('Máy tính cầm tay'));
  assert.ok(html.includes('Tặng miễn phí (0đ)'));
  assert.ok(html.includes('id="scale-slider"'));
  assert.ok(html.includes('type="range"'));
  assert.ok(html.includes('for="scale-slider"'));
  assert.ok(html.includes('aria-labelledby="cat-group-label"'));
  assert.ok(html.includes('aria-labelledby="trade-group-label"'));
  assert.ok(html.includes('lp-sim-output-ledger'));
  assert.ok(html.includes('TỔNG TIẾT KIỆM CHO PHỤ HUYNH'));
  assert.ok(html.includes('TỔNG RÁC THẢI HỌC ĐƯỜNG GIẢM'));

  // 6. RLS Privacy Architecture (Gapless Hairline Split Matrix)
  assert.ok(html.includes('POSTGRES ROW-LEVEL SECURITY'));
  assert.ok(html.includes('lp-privacy-matrix'));
  assert.ok(html.includes('CHẾ ĐỘ CÔNG KHAI TRÊN SÀN'));
  assert.ok(html.includes('0876 ••• 806'));
  assert.ok(html.includes('KHI GIÁO VIÊN &amp; BẠN DUYỆT KẾT NỐI'));
  assert.ok(html.includes('0876 637 806'));

  // 7. Swiss 4-Step Strip
  assert.ok(html.includes('Quy Trình 4 Bước Tuần Hoàn Học Liệu'));
  assert.ok(html.includes('01'));
  assert.ok(html.includes('Định Danh Học Sinh'));
  assert.ok(html.includes('02'));
  assert.ok(html.includes('Đăng Hoặc Tìm Học Liệu'));
  assert.ok(html.includes('03'));
  assert.ok(html.includes('Kiểm Duyệt &amp; Ẩn Danh'));
  assert.ok(html.includes('04'));
  assert.ok(html.includes('Bàn Giao Tại Thư Viện'));

  // 8. Curriculum Directory & Safety Matrix
  assert.ok(html.includes('CHƯƠNG TRÌNH GDPT 2018'));
  assert.ok(html.includes('Khối 10 — Tổ hợp KHTN &amp; KHXH'));
  assert.ok(html.includes('Khối 11 — Chuyên đề học tập định hướng nghề nghiệp'));
  assert.ok(html.includes('Khối 12 — Sách giáo khoa &amp; Tài liệu Ôn thi Tốt nghiệp THPT'));
  assert.ok(html.includes('Thiết bị &amp; Dụng cụ STEM — Máy tính Casio'));
  assert.ok(html.includes('4 Chốt Chặn Bảo Vệ Học Sinh &amp; Trật Tự Sư Phạm'));

  // 9. Curated Showcase Shelf with Simplified 5-Field Cards & Clean Spacing
  assert.ok(html.includes('Kệ Học Liệu Mẫu Đã Kiểm Duyệt Sẵn Có'));
  assert.ok(html.includes('lp-product-card'));
  assert.ok(html.includes('lp-container-fluid'));
  assert.ok(html.includes('lp-reveal'));
  assert.ok(html.includes('Máy tính Casio fx-580VN X'));
  assert.ok(html.includes('Bộ SGK Lớp 12 GDPT 2018 (Kết Nối Tri Thức)'));
  assert.ok(html.includes('Sách Chuyên Đề Hóa Học &amp; Vật Lý 11'));
  assert.ok(html.includes('Bộ Dụng Cụ Vẽ Kỹ Thuật &amp; Compa Chuyên Dụng'));
  assert.ok(html.includes('Chi phí nhận:'));
  assert.ok(html.includes('0 VNĐ'));
  assert.ok(html.includes('10.000 VNĐ'));
  assert.ok(html.includes('Học sinh Lớp 12A1'));
  assert.ok(html.includes('Học sinh Cựu Khóa'));
  assert.ok(html.includes('Chi đoàn 11B2'));
  assert.ok(html.includes('Học sinh Lớp 11A4'));
  assert.ok(!html.includes('landing-v2-product-skeleton'));
  // Removed clutter: description, savings box, and donor pill from card surface
  assert.ok(!html.includes('lp-card-desc'));
  assert.ok(!html.includes('lp-card-impact-box'));
  assert.ok(!html.includes('lp-card-donor-pill'));
  assert.ok(html.includes('item-showcase-card'));
  assert.ok(html.includes('Chi tiết ›'));

  // 10. Mandatory Absence of Slide 0
  assert.ok(!html.includes('DESIGN BY VUONGGIA'));
  assert.ok(!html.includes('Slide 0'));

  // 11. Footer
  assert.ok(html.includes('Vận hành phi thương mại phục vụ học sinh &amp; nhà trường.'));
});

test('Impact Simulator mathematical model correctly estimates savings and waste', () => {
  // Test Case 1: Textbook Give (Default: 10 units)
  const textbookBench = IMPACT_BENCHMARKS.textbook;
  assert.equal(textbookBench.averageRetailPrice, 50000);
  assert.equal(textbookBench.defaultWeightKg, 0.45);

  const tbGive = estimateItemImpact('textbook', 'give', 0);
  assert.equal(tbGive.financialSaved, 50000);
  assert.equal(tbGive.wasteReducedKg, 0.45);
  assert.equal(tbGive.financialSaved * 10, 500000);
  assert.equal(formatVnd(tbGive.financialSaved * 10), '500.000đ');
  assert.equal(Number((tbGive.wasteReducedKg * 10).toFixed(2)), 4.5);

  // Test Case 2: Textbook Loan (50% depreciation)
  const tbLoan = estimateItemImpact('textbook', 'loan', 0);
  assert.equal(tbLoan.financialSaved, 25000);
  assert.equal(tbLoan.wasteReducedKg, 0.45);
  assert.equal(tbLoan.financialSaved * 10, 250000);

  // Test Case 3: Calculator Loan (350.000 retail price)
  const calcBench = IMPACT_BENCHMARKS.calculator;
  assert.equal(calcBench.averageRetailPrice, 350000);
  assert.equal(calcBench.defaultWeightKg, 0.25);

  const calcLoan = estimateItemImpact('calculator', 'loan', 0);
  assert.equal(calcLoan.financialSaved, 175000);
  assert.equal(calcLoan.financialSaved * 50, 8750000);
  assert.equal(Number((calcLoan.wasteReducedKg * 50).toFixed(2)), 12.5);

  // Test Case 4: Uniform Give (100 units chi doan)
  const uniformBench = IMPACT_BENCHMARKS.uniform;
  assert.equal(uniformBench.averageRetailPrice, 120000);
  assert.equal(uniformBench.defaultWeightKg, 0.75);

  const uniformGive = estimateItemImpact('uniform', 'give', 0);
  assert.equal(uniformGive.financialSaved * 100, 12000000);
  assert.equal(Number((uniformGive.wasteReducedKg * 100).toFixed(2)), 75.0);
});

test('Showcase Item Detail Modal renders full specs, image/icon, description notes, donor badge, and action button', () => {
  // Test Modal with Casio fx-580VN X (Calculator category with icon preview)
  const casioItem = SHOWCASE_ITEMS.find((item) => item.id === 'casio-580');
  assert.ok(casioItem, 'Casio fx-580VN X item must exist');

  const casioModalHtml = renderToStaticMarkup(
    <ShowcaseDetailModal
      item={casioItem}
      onClose={() => {}}
      onSelect={() => {}}
    />
  );

  // Accessible Dialog Attributes
  assert.ok(casioModalHtml.includes('role="dialog"'));
  assert.ok(casioModalHtml.includes('aria-modal="true"'));
  assert.ok(casioModalHtml.includes('aria-labelledby="modalItemTitle"'));
  assert.ok(casioModalHtml.includes('lp-modal-container'));

  // Full Details in Modal
  assert.ok(casioModalHtml.includes('Máy tính Casio fx-580VN X'));
  assert.ok(casioModalHtml.includes('Thiết bị &amp; Máy tính'));
  assert.ok(casioModalHtml.includes('Cho mượn kỳ 1'));
  assert.ok(casioModalHtml.includes('Grade A (Mới &gt;95%)'));
  assert.ok(casioModalHtml.includes('0 VNĐ (Mượn học kỳ)'));
  assert.ok(casioModalHtml.includes('Kệ Thư viện Tầng 2'));
  assert.ok(casioModalHtml.includes('Học sinh Lớp 12A1 (Bảo mật RLS)'));

  // Description & Condition Notes
  assert.ok(casioModalHtml.includes('Máy tính Casio fx-580VN X chính hãng Bitex'));
  assert.ok(casioModalHtml.includes('Ngoại quan đẹp 96%, phím bấm nảy êm không kẹt'));

  // Trust & Teacher Seal
  assert.ok(casioModalHtml.includes('Đã kiểm duyệt bởi Giáo viên THPT'));
  assert.ok(casioModalHtml.includes('Giao dịch phi thương mại diễn ra trực tiếp tại Kệ Thư viện trường'));

  // Action Buttons
  assert.ok(casioModalHtml.includes('Đóng'));
  assert.ok(casioModalHtml.includes('Đăng ký nhận ngay tại Thư viện ›'));

  // Test Modal with SGK 12 (has authentic photo imageUrl)
  const sgkItem = SHOWCASE_ITEMS.find((item) => item.id === 'sgk-12');
  assert.ok(sgkItem, 'SGK 12 item must exist');
  assert.equal(sgkItem.imageUrl, '/assets/local-ui-books.jpg');

  const sgkModalHtml = renderToStaticMarkup(
    <ShowcaseDetailModal
      item={sgkItem}
      onClose={() => {}}
      onSelect={() => {}}
    />
  );

  assert.ok(sgkModalHtml.includes('lp-modal-photo-wrapper'));
  assert.ok(sgkModalHtml.includes('src="/assets/local-ui-books.jpg"'));
  assert.ok(sgkModalHtml.includes('alt="Bộ SGK Lớp 12 GDPT 2018 (Kết Nối Tri Thức)"'));
  assert.ok(sgkModalHtml.includes('Học sinh Cựu Khóa (Bảo mật RLS)'));
});

test('Style 4 Text & Card Animation CSS uses valid custom properties, real DOM selectors, defined keyframes, and calm mobile overrides', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const stylesDir = path.resolve(process.cwd(), 'src/styles');

  const landingCss = fs.readFileSync(path.join(stylesDir, 'legacy-landing.css'), 'utf8');
  const marketCss = fs.readFileSync(path.join(stylesDir, 'legacy-market.css'), 'utf8');
  const studentCss = fs.readFileSync(path.join(stylesDir, 'legacy-student.css'), 'utf8');
  const profileCss = fs.readFileSync(path.join(stylesDir, 'legacy-profile-legacy.css'), 'utf8');
  const adminCss = fs.readFileSync(path.join(stylesDir, 'legacy-admin.css'), 'utf8');
  const checkpointCss = fs.readFileSync(path.join(stylesDir, 'checkpoint.css'), 'utf8');

  // 1. Landing CSS: must NOT reference non-existent variables (--lp-teal, --lp-teal-mid, --lp-teal-tint, --lp-paper-alt, --lp-white)
  assert.ok(!landingCss.includes('var(--lp-teal)'), 'Must not use undefined --lp-teal');
  assert.ok(!landingCss.includes('var(--lp-teal-mid)'), 'Must not use undefined --lp-teal-mid');
  assert.ok(!landingCss.includes('var(--lp-teal-tint)'), 'Must not use undefined --lp-teal-tint');
  assert.ok(!landingCss.includes('var(--lp-paper-alt)'), 'Must not use undefined --lp-paper-alt');
  assert.ok(!landingCss.includes('var(--lp-white)'), 'Must not use undefined --lp-white');
  assert.ok(landingCss.includes('var(--lp-accent-teal'), 'Must use defined --lp-accent-teal');
  assert.ok(landingCss.includes('var(--lp-accent-emerald'), 'Must use defined --lp-accent-emerald');
  assert.ok(landingCss.includes('.lp-editorial-photo-frame'), 'Must target actual .lp-editorial-photo-frame');
  assert.ok(landingCss.includes('.lp-pillar-icon'), 'Must target actual .lp-pillar-icon');
  assert.ok(landingCss.includes('.lp-dir-badge'), 'Must target actual .lp-dir-badge');
  assert.ok(landingCss.includes('.lp-card-price-value'), 'Must target actual .lp-card-price-value');

  // 2. Market CSS: @keyframes cardStaggerFadeIn must be defined and real selectors targeted
  assert.ok(marketCss.includes('@keyframes cardStaggerFadeIn'), 'Must define @keyframes cardStaggerFadeIn');
  assert.ok(marketCss.includes('.market-product-card .market-product-title'), 'Must target .market-product-title');
  assert.ok(marketCss.includes('.market-product-card .market-product-price'), 'Must target .market-product-price');
  assert.ok(marketCss.includes('.market-banner > span'), 'Must target direct children of .market-banner');
  assert.ok(marketCss.includes('.v26-mini-card .v26-mini-title'), 'Must target .v26-mini-title');

  // 3. Student CSS: must target .owner-dashboard-compact .owner-summary-card and enable .owner-post-card::before
  assert.ok(studentCss.includes('.owner-dashboard-compact .owner-summary-card'), 'Must target .owner-dashboard-compact .owner-summary-card');
  assert.ok(studentCss.includes('.owner-controls-heading h2'), 'Must target .owner-controls-heading h2');
  assert.ok(/\.owner-post-card::before\s*\{[^}]*display:\s*block/s.test(studentCss), 'Must set display: block on .owner-post-card::before');

  // 4. Profile CSS: must target .profile-metric-tile strong
  assert.ok(profileCss.includes('.profile-metric-tile strong'), 'Must target .profile-metric-tile strong');

  // 5. Admin & Checkpoint CSS: calm mobile performance and zero gradient text
  assert.ok(adminCss.includes('.admin-chart-heading h2'), 'Must animate .admin-chart-heading h2');
  assert.ok(checkpointCss.includes('@media (prefers-reduced-motion: reduce)'), 'Must include prefers-reduced-motion in checkpoint.css');
  for (const css of [landingCss, marketCss, studentCss, profileCss, adminCss, checkpointCss]) {
    assert.ok(!css.includes('background-clip: text'), 'Must not use gradient text (background-clip: text)');
  }
});

