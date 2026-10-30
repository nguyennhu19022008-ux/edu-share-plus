import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import LandingPage from '../src/pages/LandingPage';
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
  // Removed clutter: description and savings box from cards
  assert.ok(!html.includes('lp-card-desc'));
  assert.ok(!html.includes('lp-card-impact-box'));

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
