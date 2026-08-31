export type ItemCondition = 'new_99' | 'good_85' | 'fair_70';

export interface PriceEstimateInput {
  categoryCodeOrName: string;
  condition: ItemCondition;
  originalRetailPrice?: number;
}

export interface PriceEstimateResult {
  categoryName: string;
  conditionLabel: string;
  referenceRetailPrice: number;
  maxCeilingPrice: number;
  suggestedMinPrice: number;
  suggestedMaxPrice: number;
  conditionDiscountFactor: number;
  adviceMessage: string;
}

const CATEGORY_DEFAULT_RETAIL: Record<string, { name: string; retail: number; maxRatio: number }> = {
  textbook: { name: 'Sách giáo khoa', retail: 50000, maxRatio: 0.50 },
  book: { name: 'Sách', retail: 60000, maxRatio: 0.50 },
  reference_book: { name: 'Sách tham khảo / Luyện đề', retail: 80000, maxRatio: 0.55 },
  calculator: { name: 'Máy tính cầm tay (Casio / Vinacal)', retail: 450000, maxRatio: 0.60 },
  school_supplies: { name: 'Dụng cụ học tập / Thước / Compa', retail: 30000, maxRatio: 0.50 },
  notebook: { name: 'Vở viết', retail: 20000, maxRatio: 0.50 },
  uniform: { name: 'Đồng phục / Áo khoác / Cặp sách', retail: 150000, maxRatio: 0.50 },
  other: { name: 'Đồ dùng học tập khác', retail: 50000, maxRatio: 0.50 },
};

const CONDITION_FACTORS: Record<ItemCondition, { label: string; minFactor: number; maxFactor: number }> = {
  new_99: { label: 'Như mới (99% - Còn nguyên vẹn)', minFactor: 0.45, maxFactor: 0.60 },
  good_85: { label: 'Tốt (80% - 90% - Sử dụng tốt)', minFactor: 0.30, maxFactor: 0.45 },
  fair_70: { label: 'Khá (60% - 75% - Có ghi chú / trầy xước nhẹ)', minFactor: 0.15, maxFactor: 0.30 },
};

export function estimateSchoolPrice(input: PriceEstimateInput): PriceEstimateResult {
  const normKey = String(input.categoryCodeOrName || '').toLowerCase().trim();

  let benchmark = CATEGORY_DEFAULT_RETAIL['other'];
  for (const key of Object.keys(CATEGORY_DEFAULT_RETAIL)) {
    if (normKey.includes(key) || normKey.includes(CATEGORY_DEFAULT_RETAIL[key].name.toLowerCase())) {
      benchmark = CATEGORY_DEFAULT_RETAIL[key];
      break;
    }
  }

  const retailPrice = input.originalRetailPrice && input.originalRetailPrice > 0
    ? input.originalRetailPrice
    : benchmark.retail;

  const conditionConfig = CONDITION_FACTORS[input.condition] || CONDITION_FACTORS['good_85'];

  const maxCeilingPrice = Math.round((retailPrice * benchmark.maxRatio) / 1000) * 1000;
  const suggestedMinPrice = Math.max(5000, Math.round((retailPrice * conditionConfig.minFactor) / 1000) * 1000);
  const suggestedMaxPrice = Math.min(maxCeilingPrice, Math.round((retailPrice * conditionConfig.maxFactor) / 1000) * 1000);

  let adviceMessage = `Khuyên dùng mức giá từ ${new Intl.NumberFormat('vi-VN').format(suggestedMinPrice)}đ đến ${new Intl.NumberFormat('vi-VN').format(suggestedMaxPrice)}đ để bạn bè dễ dàng tiếp cận.`;
  if (input.condition === 'fair_70') {
    adviceMessage += ' Đồ dùng có dấu vết sử dụng nên ưu tiên giá rẻ hoặc tặng kèm.';
  }

  return {
    categoryName: benchmark.name,
    conditionLabel: conditionConfig.label,
    referenceRetailPrice: retailPrice,
    maxCeilingPrice,
    suggestedMinPrice,
    suggestedMaxPrice,
    conditionDiscountFactor: conditionConfig.maxFactor,
    adviceMessage,
  };
}

export function validateInputPrice(
  inputPrice: number,
  estimate: PriceEstimateResult
): { isValid: boolean; warningMessage?: string } {
  if (inputPrice <= 0) {
    return { isValid: true };
  }

  if (inputPrice > estimate.maxCeilingPrice) {
    return {
      isValid: false,
      warningMessage: `Mức giá ${new Intl.NumberFormat('vi-VN').format(inputPrice)}đ vượt quá mức giá trần khuyến nghị (${new Intl.NumberFormat('vi-VN').format(estimate.maxCeilingPrice)}đ). Hãy cân nhắc giảm giá để hỗ trợ bạn cùng trường!`,
    };
  }

  return { isValid: true };
}
