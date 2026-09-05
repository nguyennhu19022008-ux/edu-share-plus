/**
 * EDU SHARE+ — Environmental & Financial Impact Estimation Model
 *
 * Phương pháp luận & Cơ sở khoa học:
 * 1. Nguồn Benchmark:
 *    - Khối lượng trung bình (defaultWeightKg): Quy chuẩn theo khối lượng thực tế các loại ấn phẩm,
 *      sách giáo khoa, sách tham khảo và máy tính bỏ túi được phát hành chính thức.
 *    - Giá bán lẻ trung bình (averageRetailPrice): Tham chiếu theo mức giá niêm yết của các Nhà xuất bản Giáo dục
 *      và đại lý thiết bị học đường tại thời điểm nghiên cứu.
 * 2. Công thức tính toán (Ước tính):
 *    - Tặng (give): Tiết kiệm = Giá bán lẻ trung bình; Rác thải học đường giảm = Khối lượng đồ dùng.
 *    - Cho mượn (loan): Tiết kiệm = 50% Giá bán lẻ trung bình; Rác thải học đường giảm = Khối lượng đồ dùng.
 *    - Bán giá rẻ (sale): Tiết kiệm = Max(0, Giá bán lẻ trung bình - Giá bán thực tế).
 * 3. Giới hạn sai số & Giả định:
 *    - Chỉ số phản ánh "Giá trị tiết kiệm ước tính" và "Khối lượng tài nguyên tái sử dụng ước tính",
 *      không phải số liệu đo đạc thực nghiệm tuyệt đối.
 *    - Phiên bản mô hình: v1.1-2026.
 */

import type { ItemImpactEstimate, TradeType } from './transactionTypes';
import { formatVndCompact } from '../../lib/formatters';

export interface CategoryImpactBenchmark {
  categoryCode: string;
  categoryName: string;
  defaultWeightKg: number;
  averageRetailPrice: number;
}

export const IMPACT_BENCHMARKS: Record<string, CategoryImpactBenchmark> = {
  textbook: {
    categoryCode: 'textbook',
    categoryName: 'Sách giáo khoa',
    defaultWeightKg: 0.45,
    averageRetailPrice: 50000,
  },
  book: {
    categoryCode: 'book',
    categoryName: 'Sách',
    defaultWeightKg: 0.45,
    averageRetailPrice: 50000,
  },
  reference_book: {
    categoryCode: 'reference_book',
    categoryName: 'Sách tham khảo',
    defaultWeightKg: 0.55,
    averageRetailPrice: 75000,
  },
  calculator: {
    categoryCode: 'calculator',
    categoryName: 'Máy tính cầm tay',
    defaultWeightKg: 0.25,
    averageRetailPrice: 350000,
  },
  school_supplies: {
    categoryCode: 'school_supplies',
    categoryName: 'Dụng cụ học tập',
    defaultWeightKg: 0.20,
    averageRetailPrice: 25000,
  },
  notebook: {
    categoryCode: 'notebook',
    categoryName: 'Vở viết',
    defaultWeightKg: 0.20,
    averageRetailPrice: 20000,
  },
  uniform: {
    categoryCode: 'uniform',
    categoryName: 'Đồng phục / Cặp sách',
    defaultWeightKg: 0.75,
    averageRetailPrice: 120000,
  },
};

export function estimateItemImpact(
  categoryCodeOrName: string,
  tradeType: TradeType,
  salePrice: number = 0
): ItemImpactEstimate {
  const normKey = String(categoryCodeOrName || '').toLowerCase().trim();
  
  let benchmark: CategoryImpactBenchmark | undefined;
  for (const key of Object.keys(IMPACT_BENCHMARKS)) {
    if (normKey.includes(key) || normKey.includes(IMPACT_BENCHMARKS[key].categoryName.toLowerCase())) {
      benchmark = IMPACT_BENCHMARKS[key];
      break;
    }
  }

  if (!benchmark) {
    benchmark = {
      categoryCode: 'other',
      categoryName: 'Đồ dùng học tập khác',
      defaultWeightKg: 0.40,
      averageRetailPrice: 40000,
    };
  }

  let financialSaved = benchmark.averageRetailPrice;
  const wasteReducedKg = benchmark.defaultWeightKg;

  if ((tradeType === 'sale' || tradeType === 'low_price_sale') && salePrice > 0) {
    financialSaved = Math.max(0, benchmark.averageRetailPrice - salePrice);
  } else if (tradeType === 'loan') {
    financialSaved = Math.round(benchmark.averageRetailPrice / 2);
  }

  return {
    financialSaved,
    wasteReducedKg,
    description: `Tiết kiệm ước tính ${formatVndCompact(financialSaved)} và giảm ${wasteReducedKg.toFixed(2)} kg rác thải học đường.`,
  };
}

export function formatVnd(amount: number): string {
  return formatVndCompact(amount);
}

