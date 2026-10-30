import { useState, useMemo, useEffect } from 'react';
import { navigateLegacy } from '../app/legacyRouter';
import {
  estimateItemImpact,
  IMPACT_BENCHMARKS,
  formatVnd,
} from '../features/transactions/impactCalculator';
import type { TradeType } from '../features/transactions/transactionTypes';

// ==========================================
// Simulation & Showcase Constants
// ==========================================

const SIMULATOR_CATEGORIES = [
  { code: 'textbook', label: 'Sách giáo khoa' },
  { code: 'reference_book', label: 'Sách tham khảo' },
  { code: 'calculator', label: 'Máy tính cầm tay' },
  { code: 'uniform', label: 'Đồng phục / Cặp sách' },
  { code: 'school_supplies', label: 'Dụng cụ học tập' },
] as const;

type SimulatorCategoryCode = (typeof SIMULATOR_CATEGORIES)[number]['code'];

const SIMULATOR_TRADES = [
  {
    type: 'give' as TradeType,
    label: 'Tặng miễn phí (0đ)',
    desc: 'Tiết kiệm 100% giá mua mới cho bạn học',
  },
  {
    type: 'loan' as TradeType,
    label: 'Cho mượn học kỳ',
    desc: 'Ước tính tương đương 50% chi phí khấu hao',
  },
  {
    type: 'low_price_sale' as TradeType,
    label: 'Chia sẻ giá ưu đãi (-50%)',
    desc: 'Hỗ trợ sang nhượng với giá tượng trưng',
  },
] as const;

const SCALE_PRESETS = [
  { count: 1, label: '1 món (Cá nhân)' },
  { count: 10, label: '10 món (Tủ sách lớp)' },
  { count: 50, label: '50 món (Khối lớp)' },
  { count: 100, label: '100 món (Cấp Chi đoàn)' },
] as const;

interface ShowcaseItem {
  id: string;
  title: string;
  category: string;
  categoryCode: string;
  gradeBadge: string;
  tradeType: TradeType;
  tradeLabel: string;
  badgeVariant: 'give' | 'loan' | 'sale';
  salePrice: number;
  priceDisplay: string;
  location: string;
  donorBadge: string;
  description?: string;
  searchKeyword: string;
}

const SHOWCASE_ITEMS: ShowcaseItem[] = [
  {
    id: 'casio-580',
    title: 'Máy tính Casio fx-580VN X',
    category: 'Thiết bị & Máy tính',
    categoryCode: 'calculator',
    gradeBadge: 'Grade A (Mới >95%)',
    tradeType: 'loan',
    tradeLabel: 'Cho mượn kỳ 1',
    badgeVariant: 'loan',
    salePrice: 0,
    priceDisplay: '0 VNĐ (Mượn học kỳ)',
    location: 'Kệ Thư viện Tầng 2',
    donorBadge: 'Học sinh Lớp 12A1',
    searchKeyword: 'Casio fx-580VN X',
  },
  {
    id: 'sgk-12',
    title: 'Bộ SGK Lớp 12 GDPT 2018 (Kết Nối Tri Thức)',
    category: 'Sách giáo khoa',
    categoryCode: 'textbook',
    gradeBadge: 'Grade A (Mới >90%)',
    tradeType: 'give',
    tradeLabel: 'Tặng miễn phí 0đ',
    badgeVariant: 'give',
    salePrice: 0,
    priceDisplay: '0 VNĐ (Miễn phí)',
    location: 'Kệ Sách Thư viện B3',
    donorBadge: 'Học sinh Cựu Khóa',
    searchKeyword: 'SGK Lớp 12',
  },
  {
    id: 'chuyende-11',
    title: 'Sách Chuyên Đề Hóa Học & Vật Lý 11',
    category: 'Sách tham khảo',
    categoryCode: 'reference_book',
    gradeBadge: 'Grade B (70–90%)',
    tradeType: 'give',
    tradeLabel: 'Tặng miễn phí 0đ',
    badgeVariant: 'give',
    salePrice: 0,
    priceDisplay: '0 VNĐ (Miễn phí)',
    location: 'Tủ sách Chi đoàn 11B2',
    donorBadge: 'Chi đoàn 11B2',
    searchKeyword: 'Chuyên đề 11',
  },
  {
    id: 'dungcu-stem',
    title: 'Bộ Dụng Cụ Vẽ Kỹ Thuật & Compa Chuyên Dụng',
    category: 'Dụng cụ học tập',
    categoryCode: 'school_supplies',
    gradeBadge: 'Grade A (Mới >98%)',
    tradeType: 'low_price_sale',
    tradeLabel: 'Ưu đãi 10.000đ',
    badgeVariant: 'sale',
    salePrice: 10000,
    priceDisplay: '10.000 VNĐ',
    location: 'Văn phòng Đoàn trường',
    donorBadge: 'Học sinh Lớp 11A4',
    searchKeyword: 'Bộ dụng cụ vẽ kỹ thuật',
  },
];

const CURRICULUM_DIRECTORIES = [
  {
    id: 'grade-10',
    title: 'Khối 10 — Tổ hợp KHTN & KHXH',
    subtitle: 'Sách Cánh Diều, Kết Nối Tri Thức, Chân Trời Sáng Tạo và Chuyên đề',
    keyword: 'Khối 10',
    countBadge: '48 đầu sách',
  },
  {
    id: 'grade-11',
    title: 'Khối 11 — Chuyên đề học tập định hướng nghề nghiệp',
    subtitle: 'Tài liệu phân hóa môn Toán, Lý, Hóa, Sinh, Ngữ văn & Ngoại ngữ',
    keyword: 'Khối 11',
    countBadge: '62 đầu sách',
  },
  {
    id: 'grade-12',
    title: 'Khối 12 — Sách giáo khoa & Tài liệu Ôn thi Tốt nghiệp THPT',
    subtitle: 'Bộ đề tổng ôn, tài liệu rèn luyện kỹ năng giải nhanh trắc nghiệm',
    keyword: 'Khối 12',
    countBadge: '75 đầu sách',
  },
  {
    id: 'stem-gear',
    title: 'Thiết bị & Dụng cụ STEM — Máy tính Casio',
    subtitle: 'Casio fx-580VN X, bảng vẽ hình học, bộ lắp ráp thí nghiệm',
    keyword: 'STEM',
    countBadge: '34 thiết bị',
  },
  {
    id: 'uniform-gear',
    title: 'Đồng phục THPT & Cặp sách học sinh',
    subtitle: 'Áo sơ mi trắng, áo khoác gió đồng phục mùa đông còn mới tốt',
    keyword: 'Đồng phục',
    countBadge: '29 sản phẩm',
  },
];

export default function LandingPage() {
  const [search, setSearch] = useState('');

  // Simulator State
  const [selectedCategory, setSelectedCategory] = useState<SimulatorCategoryCode>('textbook');
  const [selectedTrade, setSelectedTrade] = useState<TradeType>('give');
  const [itemCount, setItemCount] = useState<number>(10);

  const startMarketplaceSearch = (prefill?: string) => {
    const keyword = String(prefill ?? search).trim();
    if (prefill !== undefined) setSearch(keyword);
    navigateLegacy('loginStudent', keyword ? { search: keyword } : {});
  };

  // Calculation for Circular Impact Simulator
  const impactResult = useMemo(() => {
    const benchmark = IMPACT_BENCHMARKS[selectedCategory] ?? {
      categoryCode: selectedCategory,
      categoryName: 'Học liệu',
      defaultWeightKg: 0.4,
      averageRetailPrice: 50000,
    };

    const simulatedPrice =
      selectedTrade === 'low_price_sale' || selectedTrade === 'sale'
        ? Math.round(benchmark.averageRetailPrice * 0.5)
        : 0;

    const singleImpact = estimateItemImpact(selectedCategory, selectedTrade, simulatedPrice);
    const totalFinancialSaved = singleImpact.financialSaved * itemCount;
    const totalWasteKg = Number((singleImpact.wasteReducedKg * itemCount).toFixed(2));

    return {
      benchmark,
      singleImpact,
      totalFinancialSaved,
      totalWasteKg,
    };
  }, [selectedCategory, selectedTrade, itemCount]);

  // Scroll reveal animation observer
  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );

    const targets = document.querySelectorAll('.lp-reveal');
    targets.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <div className="lp-landing-page">
      {/* 1. Institutional Top Bar */}
      <div className="lp-topbar" role="status" aria-label="Thông tin đề tài nghiên cứu">
        <div className="lp-container lp-container-fluid lp-topbar-inner">
          <div className="lp-topbar-left">
            <span className="lp-topbar-dot" aria-hidden="true" />
            <span className="lp-topbar-badge">DỰ ÁN KHKT LĨNH VỰC HÀNH VI (BEHA)</span>
            <span className="lp-topbar-divider" aria-hidden="true">•</span>
            <span className="lp-topbar-text">MÔ HÌNH KINH TẾ TUẦN HOÀN HỌC ĐƯỜNG</span>
          </div>
          <div className="lp-topbar-right">
            <span>100% Bài đăng kiểm duyệt bởi Giáo viên</span>
            <span className="lp-topbar-divider" aria-hidden="true">•</span>
            <span>Giao dịch 0 VNĐ tại Thư viện</span>
          </div>
        </div>
      </div>

      {/* 2. Sticky Header & Architectural Navigation */}
      <header className="lp-header" role="banner">
        <div className="lp-container lp-container-fluid lp-header-inner">
          <button
            type="button"
            className="lp-brand-btn"
            onClick={() => navigateLegacy('landing')}
            aria-label="Về trang chủ Edu Share+"
          >
            <span className="lp-brand-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                <path d="M6 6h10" />
                <path d="M6 10h10" />
                <path d="m9 16 2 2 4-4" />
              </svg>
            </span>
            <span className="lp-brand-text">
              Edu Share<span className="lp-brand-plus">+</span>
            </span>
          </button>

          <nav className="lp-nav-menu" aria-label="Điều hướng chính">
            <a href="#about">Về Dự Án</a>
            <a href="#impact-bento">Máy Tính Tác Động</a>
            <a href="#process">Quy Trình</a>
            <a href="#policy">Chính Sách</a>
            <a href="#showcase">Học Liệu Mẫu</a>
          </nav>

          <div className="lp-header-actions">
            <button
              type="button"
              className="lp-btn lp-btn-ghost"
              onClick={() => navigateLegacy('loginGV')}
              aria-label="Đăng nhập dành cho Giáo viên quản trị"
            >
              Quản trị viên
            </button>
            <button
              type="button"
              className="lp-btn lp-btn-outline"
              onClick={() => navigateLegacy('loginStudent')}
              aria-label="Đăng nhập tài khoản học sinh"
            >
              Đăng nhập
            </button>
            <button
              type="button"
              className="lp-btn lp-btn-primary"
              onClick={() => navigateLegacy('registerStudent')}
              aria-label="Tạo tài khoản học sinh mới"
            >
              Tạo tài khoản
            </button>
          </div>
        </div>
      </header>

      <main className="lp-main-content">
        {/* 3. Section 2: Hero Split Architecture (7:5 Split) */}
        <section className="lp-section lp-hero-section lp-reveal" id="about" aria-labelledby="heroTitle">
          <div className="lp-container lp-container-fluid">
            <div className="lp-hero-frame">
              {/* Left Column: 7 Parts */}
              <div className="lp-hero-left">
                <div className="lp-kicker-badge">
                  <svg className="lp-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                  <span>SÀN CHIA SẺ &amp; TÁI SỬ DỤNG HỌC LIỆU CÓ KIỂM DUYỆT</span>
                </div>

                <h1 id="heroTitle" className="lp-hero-title">
                  Cũ với bạn,{' '}
                  <span className="lp-hero-title-accent">hữu ích với người khác.</span>
                </h1>

                <p className="lp-hero-description">
                  Mô hình giải quyết triệt để rào cản tâm lý e ngại xã hội khi trao đổi đồ dùng học tập.
                  Kết nối học sinh cho mượn, tặng và nhượng lại sách giáo khoa, máy tính cầm tay và thiết bị
                  học tập thiết yếu hoàn toàn minh bạch trong khuôn viên nhà trường.
                </p>

                {/* Architectural Search Bar */}
                <form
                  className="lp-search-bar"
                  role="search"
                  aria-label="Tìm kiếm học liệu"
                  onSubmit={(e) => {
                    e.preventDefault();
                    startMarketplaceSearch();
                  }}
                >
                  <div className="lp-search-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.3-4.3" />
                    </svg>
                  </div>
                  <input
                    type="search"
                    id="lpSearchInput"
                    name="q"
                    className="lp-search-input"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Tìm máy tính Casio, SGK GDPT 2018, đồ vẽ kỹ thuật..."
                    aria-label="Từ khóa tìm kiếm học liệu"
                  />
                  <button
                    type="submit"
                    className="lp-search-submit-btn"
                  >
                    Tìm kiếm
                  </button>
                </form>

                {/* Quick Filter Pills */}
                <div className="lp-quick-pills" aria-label="Từ khóa gợi ý tìm nhanh">
                  <span className="lp-quick-pills-label">Gợi ý tìm nhanh:</span>
                  <div className="lp-pills-wrap">
                    <button type="button" className="lp-pill-btn" onClick={() => startMarketplaceSearch('Casio fx-580VN X')}>
                      Casio fx-580VN X
                    </button>
                    <button type="button" className="lp-pill-btn" onClick={() => startMarketplaceSearch('SGK Lớp 12 GDPT 2018')}>
                      SGK Lớp 12 GDPT 2018
                    </button>
                    <button type="button" className="lp-pill-btn" onClick={() => startMarketplaceSearch('Sách chuyên đề Lý - Hóa')}>
                      Sách chuyên đề Lý - Hóa
                    </button>
                    <button type="button" className="lp-pill-btn" onClick={() => startMarketplaceSearch('Bộ dụng cụ vẽ kỹ thuật')}>
                      Bộ dụng cụ vẽ kỹ thuật
                    </button>
                    <button type="button" className="lp-pill-btn" onClick={() => startMarketplaceSearch('Đồng phục THPT')}>
                      Đồng phục THPT
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: 5 Parts (Empirical Ledger Matrix) */}
              <div className="lp-hero-right">
                <div className="lp-ledger-header">
                  <span className="lp-ledger-badge">BẢNG CHỈ SỐ THỰC CHỨNG BEHA</span>
                  <h2 className="lp-ledger-title">Thông Số Can Thiệp Thực Nghiệm</h2>
                  <p className="lp-ledger-subtitle">
                    Dữ liệu khảo sát và đo lường tác động can thiệp tâm lý - xã hội trong môi trường học đường.
                  </p>
                </div>

                <div className="lp-ledger-grid" role="region" aria-label="Chỉ số nghiên cứu thực nghiệm">
                  <div className="lp-ledger-cell">
                    <span className="lp-ledger-num lp-ink-teal">83,66%</span>
                    <strong className="lp-ledger-lbl">Sẵn sàng chia sẻ</strong>
                    <span className="lp-ledger-desc">
                      Tỷ lệ học sinh sẵn lòng tặng đồ sau khi có quy trình ẩn danh (n₁ = 722)
                    </span>
                  </div>

                  <div className="lp-ledger-cell">
                    <span className="lp-ledger-num lp-ink-amber">+16,22%</span>
                    <strong className="lp-ledger-lbl">Tác động ròng DiD</strong>
                    <span className="lp-ledger-desc">
                      Mức tăng hành vi tuần hoàn thuần túy với độ tin cậy thực nghiệm (p &lt; 0.001)
                    </span>
                  </div>

                  <div className="lp-ledger-cell">
                    <span className="lp-ledger-num lp-ink-dark">100%</span>
                    <strong className="lp-ledger-lbl">Bảo vệ danh tính</strong>
                    <span className="lp-ledger-desc">
                      Mã hóa và che số điện thoại tự động qua chính sách bảo mật cơ sở dữ liệu RLS
                    </span>
                  </div>

                  <div className="lp-ledger-cell">
                    <span className="lp-ledger-num lp-ink-dark">0 VNĐ</span>
                    <strong className="lp-ledger-lbl">Phí sàn học đường</strong>
                    <span className="lp-ledger-desc">
                      Vận hành phi thương mại, bàn giao học liệu trực tiếp tại Kệ sách Thư viện
                    </span>
                  </div>
                </div>

                <div className="lp-ledger-footer">
                  <svg className="lp-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <span>Cơ sở phương pháp luận: Nghiên cứu Khoa học Kỹ thuật Lĩnh vực BEHA 2025-2026.</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Section 3: Gapless Bento Matrix & Interactive Impact Simulator */}
        <section className="lp-section lp-reveal" id="impact-bento" aria-labelledby="bentoSectionTitle">
          <div className="lp-container lp-container-fluid">
            <div className="lp-section-header">
              <span className="lp-section-kicker">MÔ HÌNH TOÁN HỌC &amp; BẢO MẬT HỌC ĐƯỜNG</span>
              <h2 id="bentoSectionTitle" className="lp-section-title">
                Lượng Hóa Tác Động Tuần Hoàn &amp; Kiến Trúc Bảo Vệ RLS
              </h2>
              <p className="lp-section-desc">
                Trực tiếp mô phỏng công thức tính toán giá trị kinh tế tiết kiệm cho phụ huynh và khối lượng
                rác thải học đường giảm thiểu dựa trên bộ chuẩn dữ liệu thực tế.
              </p>
            </div>

            <div className="lp-bento-matrix">
              {/* Bento Cell 1: 7 Columns — Interactive Circular Impact Simulator */}
              <div className="lp-bento-cell lp-bento-span-7 lp-simulator-cell">
                <div className="lp-cell-badge-row">
                  <span className="lp-tag-accent">MÔ PHỎNG TƯƠNG TÁC THỰC THỜI</span>
                  <span className="lp-tag-mono">MODEL V1.1-2026</span>
                </div>

                <h3 className="lp-cell-title">Máy Tính Tác Động Kinh Tế &amp; Môi Trường</h3>
                <p className="lp-cell-subtitle">
                  Chọn loại tài nguyên học tập, hình thức tuần hoàn và số lượng đồ dùng để kiểm chứng công thức định lượng:
                </p>

                {/* Simulator Controls */}
                <div className="lp-sim-controls">
                  {/* Category Picker */}
                  <div className="lp-sim-group">
                    <span className="lp-sim-label" id="cat-group-label">
                      1. Phân loại tài nguyên học tập:
                    </span>
                    <div className="lp-sim-tabs" role="radiogroup" aria-labelledby="cat-group-label">
                      {SIMULATOR_CATEGORIES.map((cat) => (
                        <button
                          key={cat.code}
                          type="button"
                          role="radio"
                          aria-checked={selectedCategory === cat.code}
                          className={`lp-sim-tab ${selectedCategory === cat.code ? 'is-active' : ''}`}
                          onClick={() => setSelectedCategory(cat.code)}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Trade Type Picker */}
                  <div className="lp-sim-group">
                    <span className="lp-sim-label" id="trade-group-label">
                      2. Hình thức tuần hoàn tài nguyên:
                    </span>
                    <div className="lp-sim-trades" role="radiogroup" aria-labelledby="trade-group-label">
                      {SIMULATOR_TRADES.map((trade) => (
                        <button
                          key={trade.type}
                          type="button"
                          role="radio"
                          aria-checked={selectedTrade === trade.type}
                          className={`lp-trade-opt ${selectedTrade === trade.type ? 'is-active' : ''}`}
                          onClick={() => setSelectedTrade(trade.type)}
                        >
                          <span className="lp-trade-radio-indicator" aria-hidden="true" />
                          <div className="lp-trade-text">
                            <strong>{trade.label}</strong>
                            <small>{trade.desc}</small>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quantity / Scale Picker with Interactive Range Slider */}
                  <div className="lp-sim-group">
                    <div className="lp-sim-scale-header">
                      <label className="lp-sim-label" htmlFor="scale-slider">
                        3. Quy mô mô phỏng: <strong className="lp-font-mono lp-ink-teal">{itemCount} món đồ dùng</strong>
                      </label>
                    </div>
                    <div className="lp-sim-slider-row">
                      <input
                        type="range"
                        id="scale-slider"
                        className="lp-sim-range-slider"
                        min={1}
                        max={100}
                        step={1}
                        value={itemCount}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setItemCount(Number.isFinite(val) ? Math.max(1, Math.min(200, val)) : 1);
                        }}
                        aria-label="Số lượng đồ dùng mô phỏng"
                      />
                      <span className="lp-sim-slider-val lp-font-mono">{itemCount}</span>
                    </div>
                    <div className="lp-scale-presets">
                      {SCALE_PRESETS.map((preset) => (
                        <button
                          key={preset.count}
                          type="button"
                          className={`lp-scale-preset-btn ${itemCount === preset.count ? 'is-active' : ''}`}
                          onClick={() => setItemCount(preset.count)}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Instant Calculation Output Ledger (Architectural Hairline - Anti Cards-in-Cards) */}
                <div className="lp-sim-output-ledger" aria-live="polite">
                  <div className="lp-sim-metrics-grid">
                    <div className="lp-sim-metric-cell">
                      <span className="lp-metric-label">TỔNG TIẾT KIỆM CHO PHỤ HUYNH</span>
                      <strong className="lp-metric-value lp-ink-teal">
                        {formatVnd(impactResult.totalFinancialSaved)}
                      </strong>
                      <span className="lp-metric-sub">
                        Giá bán lẻ niêm yết: {formatVnd(impactResult.benchmark.averageRetailPrice)} / món
                      </span>
                    </div>

                    <div className="lp-sim-metric-cell">
                      <span className="lp-metric-label">TỔNG RÁC THẢI HỌC ĐƯỜNG GIẢM</span>
                      <strong className="lp-metric-value lp-ink-dark">
                        {impactResult.totalWasteKg.toFixed(2)} kg
                      </strong>
                      <span className="lp-metric-sub">
                        Khối lượng trung bình: {impactResult.benchmark.defaultWeightKg.toFixed(2)} kg / món
                      </span>
                    </div>
                  </div>

                  <div className="lp-sim-calc-note">
                    <svg className="lp-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>
                      <strong>Kết quả lượng hóa:</strong> Với quy mô {itemCount} món {impactResult.benchmark.categoryName.toLowerCase()}, mô hình ước tính giảm bớt áp lực tài chính {formatVnd(impactResult.totalFinancialSaved)} và tái tuần hoàn {impactResult.totalWasteKg.toFixed(2)} kg tài nguyên giấy/kim loại/nhựa.
                    </span>
                  </div>
                </div>
              </div>

              {/* Bento Cell 2: 5 Columns — RLS Privacy Architecture */}
              <div className="lp-bento-cell lp-bento-span-5 lp-privacy-cell">
                <div className="lp-cell-badge-row">
                  <span className="lp-tag-dark">POSTGRES ROW-LEVEL SECURITY</span>
                  <span className="lp-tag-mono">ANTI-ANXIETY UX</span>
                </div>

                <h3 className="lp-cell-title">Kiến Trúc Bảo Mật Triệt Tiêu Nỗi Sợ Danh Tính</h3>
                <p className="lp-cell-subtitle">
                  Khảo sát BEHA chứng minh <strong>88,9% học sinh e ngại lộ số điện thoại</strong> và{' '}
                  <strong>61,4% sợ áp lực xã hội</strong> khi cho/tặng đồ cũ. Edu Share+ xử lý bằng cơ chế phân quyền bảo mật RLS 2 lớp:
                </p>

                {/* Privacy Contrast Demonstration (Hairline Split Matrix - Anti Cards-in-Cards) */}
                <div className="lp-privacy-matrix">
                  <div className="lp-privacy-pane is-public">
                    <div className="lp-privacy-pane-top">
                      <span className="lp-privacy-status is-locked">CHẾ ĐỘ CÔNG KHAI TRÊN SÀN</span>
                    </div>
                    <div className="lp-privacy-row">
                      <span className="lp-privacy-key">Số điện thoại:</span>
                      <span className="lp-privacy-val lp-font-mono">0876 ••• 806</span>
                    </div>
                    <div className="lp-privacy-row">
                      <span className="lp-privacy-key">Danh tính người đăng:</span>
                      <span className="lp-privacy-val">Học sinh Lớp 11 (Ẩn danh)</span>
                    </div>
                    <div className="lp-privacy-row">
                      <span className="lp-privacy-key">Quyền truy cập:</span>
                      <span className="lp-privacy-badge-red">Bảo mật RLS khóa hoàn toàn</span>
                    </div>
                    <p className="lp-privacy-pane-note">
                      Người lạ hoặc người chưa được duyệt kết nối tuyệt đối không thể xem số điện thoại hay thông tin cá nhân.
                    </p>
                  </div>

                  <div className="lp-privacy-pane is-verified">
                    <div className="lp-privacy-pane-top">
                      <span className="lp-privacy-status is-unlocked">KHI GIÁO VIÊN &amp; BẠN DUYỆT KẾT NỐI</span>
                    </div>
                    <div className="lp-privacy-row">
                      <span className="lp-privacy-key">Số điện thoại liên hệ:</span>
                      <span className="lp-privacy-val lp-font-mono lp-ink-teal">0876 637 806</span>
                    </div>
                    <div className="lp-privacy-row">
                      <span className="lp-privacy-key">Điểm hẹn bàn giao:</span>
                      <span className="lp-privacy-val">Kệ Thư viện A2 (Có giám sát)</span>
                    </div>
                    <div className="lp-privacy-row">
                      <span className="lp-privacy-key">Trạng thái đối soát:</span>
                      <span className="lp-privacy-badge-green">Mở kết nối an toàn có nhật ký</span>
                    </div>
                    <p className="lp-privacy-pane-note">
                      Chỉ hiển thị thông tin khi cả Giáo viên kiểm duyệt và Người cho tặng chấp thuận yêu cầu mượn/nhận.
                    </p>
                  </div>
                </div>

                <div className="lp-cell-bottom-banner">
                  <svg className="lp-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span>Chính sách RLS thực thi tại tầng cơ sở dữ liệu Supabase, không thể vượt qua bằng thủ thuật giao diện.</span>
                </div>
              </div>

              {/* Lower Bento Row: 3 Gapless Cells (4 - 4 - 4 Columns) */}
              <div className="lp-bento-cell lp-bento-span-4">
                <div className="lp-pillar-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                </div>
                <span className="lp-pillar-kicker">CHỐT CHẶN NỘI DUNG</span>
                <h4 className="lp-pillar-title">Kiểm Duyệt 2 Lớp Tự Động &amp; Giáo Viên</h4>
                <p className="lp-pillar-desc">
                  Mọi bài đăng đều đi qua bộ lọc từ khóa chuẩn tắc và sự kiểm duyệt trực tiếp từ Ban Giám thị / Thầy Cô phụ trách trước khi xuất hiện trên sàn.
                </p>
                <div className="lp-pillar-badge">100% Bài đăng hợp lệ</div>
              </div>

              <div className="lp-bento-cell lp-bento-span-4">
                <div className="lp-pillar-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 3h5v5" />
                    <path d="M4 20L21 3" />
                    <path d="M21 16v5h-5" />
                    <path d="M15 15l6 6" />
                    <path d="M4 4l5 5" />
                  </svg>
                </div>
                <span className="lp-pillar-kicker">GIAO THỨC MINH BẠCH</span>
                <h4 className="lp-pillar-title">Xác Thực Hai Phía (2-Sided Verification)</h4>
                <p className="lp-pillar-desc">
                  Giao dịch chỉ được đóng hoàn tất và tích lũy điểm uy tín khi cả Người trao và Người nhận cùng bấm xác nhận thực tế tại Kệ sách Thư viện.
                </p>
                <div className="lp-pillar-badge">Chống gian lận &amp; thất lạc</div>
              </div>

              <div className="lp-bento-cell lp-bento-span-4">
                <div className="lp-pillar-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                </div>
                <span className="lp-pillar-kicker">AN TOÀN HỌC ĐƯỜNG</span>
                <h4 className="lp-pillar-title">Kệ Sách Thư Viện &amp; Văn Phòng Đoàn</h4>
                <p className="lp-pillar-desc">
                  Điểm tiếp nhận vật lý cố định trong trường. Nghiêm cấm tuyệt đối mọi hành vi hẹn gặp trao đổi đồ tại các khu vực ngoài khuôn viên trường.
                </p>
                <div className="lp-pillar-badge">Địa điểm kiểm soát 100%</div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Section 4: Swiss Horizontal Step Strip */}
        <section className="lp-section lp-section-alt lp-reveal" id="process" aria-labelledby="processSectionTitle">
          <div className="lp-container lp-container-fluid">
            <div className="lp-section-header">
              <span className="lp-section-kicker">WORKFLOW PROTOCOL</span>
              <h2 id="processSectionTitle" className="lp-section-title">
                Quy Trình 4 Bước Tuần Hoàn Học Liệu
              </h2>
              <p className="lp-section-desc">
                Quy chuẩn giao tiếp và chuyển giao học liệu bảo đảm văn minh học đường, an toàn thông tin và dễ dàng tham gia cho mọi học sinh.
              </p>
            </div>

            <div className="lp-step-strip" role="list">
              <div className="lp-step-item" role="listitem">
                <span className="lp-step-num">01</span>
                <div className="lp-step-body">
                  <h3 className="lp-step-title">Định Danh Học Sinh</h3>
                  <p className="lp-step-desc">
                    Đăng nhập bằng tài khoản học sinh đã đối soát danh sách lớp. Hệ thống xác thực tư cách thành viên nhà trường.
                  </p>
                  <span className="lp-step-pill">Học sinh trường xác thực</span>
                </div>
              </div>

              <div className="lp-step-item" role="listitem">
                <span className="lp-step-num">02</span>
                <div className="lp-step-body">
                  <h3 className="lp-step-title">Đăng Hoặc Tìm Học Liệu</h3>
                  <p className="lp-step-desc">
                    Phân loại rõ tình trạng vật lý (Grade A &gt;90%, Grade B 70-90%, Grade C Đủ dùng) và hình thức (Tặng/Mượn/Giá rẻ).
                  </p>
                  <span className="lp-step-pill">Tiêu chuẩn phân hạng chuẩn</span>
                </div>
              </div>

              <div className="lp-step-item" role="listitem">
                <span className="lp-step-num">03</span>
                <div className="lp-step-body">
                  <h3 className="lp-step-title">Kiểm Duyệt &amp; Ẩn Danh</h3>
                  <p className="lp-step-desc">
                    Giáo viên thẩm định tính hợp lệ của bài đăng. Hệ thống kích hoạt RLS che số điện thoại để loại bỏ e ngại tiếp xúc.
                  </p>
                  <span className="lp-step-pill">Bảo mật RLS hai lớp</span>
                </div>
              </div>

              <div className="lp-step-item" role="listitem">
                <span className="lp-step-num">04</span>
                <div className="lp-step-body">
                  <h3 className="lp-step-title">Bàn Giao Tại Thư Viện</h3>
                  <p className="lp-step-desc">
                    Học sinh nhận học liệu tại Kệ Thư viện trường và bấm xác nhận hoàn tất hai phía để ghi nhận vào lịch sử tuần hoàn.
                  </p>
                  <span className="lp-step-pill">Giao nhận an toàn 100%</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 6. Section 5: Curriculum Directory & Safety Policy Split (5:7 Split) */}
        <section className="lp-section lp-reveal" id="policy" aria-labelledby="policySectionTitle">
          <div className="lp-container lp-container-fluid">
            <div className="lp-split-frame">
              {/* Left Column: Curriculum Directory (5 parts) */}
              <div className="lp-split-left">
                <div className="lp-directory-header">
                  <span className="lp-kicker-badge">CHƯƠNG TRÌNH GDPT 2018</span>
                  <h3 className="lp-frame-title">Danh Mục Học Liệu Theo Khối Lớp</h3>
                  <p className="lp-frame-desc">
                    Truy cập nhanh kho tài nguyên học tập được phân loại chuẩn theo chương trình giáo dục phổ thông mới:
                  </p>
                </div>

                <div className="lp-directory-list" role="list">
                  {CURRICULUM_DIRECTORIES.map((dir) => (
                    <button
                      key={dir.id}
                      type="button"
                      className="lp-directory-row"
                      role="listitem"
                      onClick={() => startMarketplaceSearch(dir.keyword)}
                      aria-label={`Tìm kiếm tài nguyên ${dir.title}`}
                    >
                      <div className="lp-dir-content">
                        <strong className="lp-dir-title">{dir.title}</strong>
                        <span className="lp-dir-sub">{dir.subtitle}</span>
                      </div>
                      <div className="lp-dir-meta">
                        <span className="lp-dir-badge">{dir.countBadge}</span>
                        <svg className="lp-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="lp-directory-cta">
                  <button
                    type="button"
                    className="lp-btn lp-btn-outline lp-w-full"
                    onClick={() => startMarketplaceSearch('')}
                  >
                    Khám phá toàn bộ danh mục trên Sàn ›
                  </button>
                </div>
              </div>

              {/* Right Column: 4 Safety Checkpoints & Institutional Governance (7 parts) */}
              <div className="lp-split-right">
                <div className="lp-safety-header">
                  <span className="lp-kicker-badge">QUẢN TRỊ AN TOÀN TRƯỜNG HỌC</span>
                  <h3 id="policySectionTitle" className="lp-frame-title">
                    4 Chốt Chặn Bảo Vệ Học Sinh &amp; Trật Tự Sư Phạm
                  </h3>
                  <p className="lp-frame-desc">
                    Hệ thống chính sách được thiết kế nghiêm ngặt nhằm bảo đảm môi trường giáo dục an toàn, phi thương mại và văn minh.
                  </p>
                </div>

                <div className="lp-safety-matrix">
                  <div className="lp-safety-cell">
                    <span className="lp-safety-num">01</span>
                    <h4 className="lp-safety-title">Kiểm Duyệt Trước Khi Lên Sàn</h4>
                    <p className="lp-safety-desc">
                      Tất cả bài đăng sách và đồ dùng phải được giáo viên kiểm tra nội dung, hình ảnh và tính phù hợp trước khi hiển thị công khai.
                    </p>
                  </div>

                  <div className="lp-safety-cell">
                    <span className="lp-safety-num">02</span>
                    <h4 className="lp-safety-title">Bảo Vệ Dữ Liệu Cá Nhân RLS</h4>
                    <p className="lp-safety-desc">
                      Số điện thoại, địa chỉ lớp và thông tin cá nhân của học sinh được mã hóa cấp cơ sở dữ liệu, không thể lộ ra bên ngoài.
                    </p>
                  </div>

                  <div className="lp-safety-cell">
                    <span className="lp-safety-num">03</span>
                    <h4 className="lp-safety-title">Cơ Chế Báo Cáo Vi Phạm Nhanh</h4>
                    <p className="lp-safety-desc">
                      Bất kỳ học sinh nào cũng có quyền gắn cờ báo cáo bài đăng bất thường. Hệ thống tự động tạm ngưng bài đăng để giáo viên xử lý.
                    </p>
                  </div>

                  <div className="lp-safety-cell">
                    <span className="lp-safety-num">04</span>
                    <h4 className="lp-safety-title">Nhật Ký Giao Dịch Bất Biến</h4>
                    <p className="lp-safety-desc">
                      Lưu vết đầy đủ các lượt bàn giao học liệu, phục vụ công tác giải quyết thắc mắc và tính điểm thi đua tuần hoàn cho Chi đoàn.
                    </p>
                  </div>
                </div>

                <div className="lp-safety-cta-box">
                  <div className="lp-safety-cta-text">
                    <strong>Đồng hành xây dựng văn hóa chia sẻ văn minh</strong>
                    <span>Đăng ký tham gia ngay với mã học sinh trường để kích hoạt quyền trao đổi.</span>
                  </div>
                  <button
                    type="button"
                    className="lp-btn lp-btn-primary"
                    onClick={() => navigateLegacy('registerStudent')}
                  >
                    Tham gia cộng đồng ngay
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 7. Section 6: Curated Sample Shelf (Replaces Empty Skeletons) */}
        <section className="lp-section lp-section-alt lp-reveal" id="showcase" aria-labelledby="showcaseSectionTitle">
          <div className="lp-container lp-container-fluid">
            <div className="lp-showcase-heading">
              <div>
                <span className="lp-section-kicker">CURATED SAMPLE SHELF</span>
                <h2 id="showcaseSectionTitle" className="lp-section-title">
                  Kệ Học Liệu Mẫu Đã Kiểm Duyệt Sẵn Có
                </h2>
                <p className="lp-section-desc">
                  Các ấn phẩm và thiết bị tiêu biểu đang sẵn sàng tiếp nhận lượt mượn hoặc trao tặng tại Kệ sách Thư viện trường:
                </p>
              </div>
              <button
                type="button"
                className="lp-btn lp-btn-outline"
                onClick={() => navigateLegacy('loginStudent')}
              >
                Xem tất cả học liệu trên Sàn ›
              </button>
            </div>

            <div className="lp-showcase-grid" role="region" aria-label="Kệ học liệu mẫu">
              {SHOWCASE_ITEMS.map((item) => (
                <article key={item.id} className="lp-showcase-card lp-product-card">
                  {/* Field 1: Loại giao dịch & Grade sản phẩm */}
                  <div className="lp-card-header">
                    <span className={`lp-trade-badge lp-badge-${item.badgeVariant}`}>
                      {item.tradeLabel}
                    </span>
                    <span className="lp-grade-badge">{item.gradeBadge}</span>
                  </div>

                  {/* Field 2: Tên sản phẩm & Danh mục */}
                  <div className="lp-card-body">
                    <span className="lp-card-category">{item.category}</span>
                    <h3 className="lp-card-title">{item.title}</h3>
                  </div>

                  {/* Field 3: Giá tiền */}
                  <div className="lp-card-price-row">
                    <span className="lp-card-price-label">Chi phí nhận:</span>
                    <strong className="lp-card-price-value">{item.priceDisplay}</strong>
                  </div>

                  {/* Field 4 & 5: Nơi đăng ký nhận & Thông tin liên hệ / Người chia sẻ */}
                  <div className="lp-card-footer">
                    <div className="lp-card-location-meta">
                      <div className="lp-card-location">
                        <svg className="lp-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        <span>{item.location}</span>
                      </div>
                      <div className="lp-card-donor-pill" title="Người chia sẻ">
                        <svg className="lp-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                        <span>{item.donorBadge}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="lp-card-action-btn"
                      onClick={() => startMarketplaceSearch(item.searchKeyword)}
                      aria-label={`Đăng ký nhận ${item.title}`}
                    >
                      Đăng ký nhận ›
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* 8. Institutional Footer */}
      <footer className="lp-footer" role="contentinfo">
        <div className="lp-container lp-container-fluid lp-footer-inner">
          <div className="lp-footer-top">
            <div className="lp-footer-brand">
              <span className="lp-brand-text lp-text-white">
                Edu Share<span className="lp-brand-plus">+</span>
              </span>
              <p className="lp-footer-tagline">
                Nền tảng chia sẻ và tái sử dụng học liệu học đường có kiểm duyệt. Giải quyết rào cản e ngại xã hội, thúc đẩy kinh tế tuần hoàn trong trường học.
              </p>
              <div className="lp-footer-status">
                <span className="lp-topbar-dot" aria-hidden="true" />
                <span>Hệ thống đang hoạt động an toàn • Năm học 2025 - 2026</span>
              </div>
            </div>

            <div className="lp-footer-links-group">
              <span className="lp-footer-group-title">ĐIỀU HƯỚNG NHANH</span>
              <a href="#about" className="lp-footer-link">Về dự án nghiên cứu</a>
              <a href="#impact-bento" className="lp-footer-link">Máy tính tác động tuần hoàn</a>
              <a href="#process" className="lp-footer-link">Quy trình 4 bước</a>
              <a href="#policy" className="lp-footer-link">Chính sách an toàn &amp; RLS</a>
              <a href="#showcase" className="lp-footer-link">Kệ học liệu mẫu</a>
            </div>

            <div className="lp-footer-links-group">
              <span className="lp-footer-group-title">CỔNG TRUY CẬP</span>
              <button type="button" className="lp-footer-btn-link" onClick={() => navigateLegacy('loginStudent')}>
                Đăng nhập học sinh
              </button>
              <button type="button" className="lp-footer-btn-link" onClick={() => navigateLegacy('registerStudent')}>
                Đăng ký tài khoản học sinh
              </button>
              <button type="button" className="lp-footer-btn-link" onClick={() => navigateLegacy('loginGV')}>
                Cổng kiểm duyệt dành cho Giáo viên
              </button>
            </div>
          </div>

          <div className="lp-footer-bottom">
            <div className="lp-footer-academic">
              DỰ ÁN KHOA HỌC KỸ THUẬT LĨNH VỰC HÀNH VI (BEHA) • MÔ HÌNH KINH TẾ TUẦN HOÀN HỌC ĐƯỜNG
            </div>
            <div className="lp-footer-copy">
              Vận hành phi thương mại phục vụ học sinh &amp; nhà trường. Mọi giao dịch thực hiện tại Kệ Thư viện trường.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
