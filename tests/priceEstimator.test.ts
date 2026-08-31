import assert from 'node:assert/strict';
import test from 'node:test';
import { estimateSchoolPrice, validateInputPrice } from '../src/features/estimator/priceEstimator';

test('estimateSchoolPrice calculates ceiling and suggested prices for calculators', () => {
  const estimate = estimateSchoolPrice({
    categoryCodeOrName: 'calculator',
    condition: 'good_85',
    originalRetailPrice: 450000,
  });

  assert.equal(estimate.categoryName, 'Máy tính cầm tay (Casio / Vinacal)');
  assert.equal(estimate.maxCeilingPrice, 270000); // 450k * 0.60
  assert.ok(estimate.suggestedMinPrice <= estimate.suggestedMaxPrice);
  assert.ok(estimate.suggestedMaxPrice <= estimate.maxCeilingPrice);
});

test('estimateSchoolPrice supports custom retail price', () => {
  const estimate = estimateSchoolPrice({
    categoryCodeOrName: 'textbook',
    condition: 'new_99',
    originalRetailPrice: 80000,
  });

  assert.equal(estimate.maxCeilingPrice, 40000); // 80k * 0.50
});

test('validateInputPrice detects excessive prices beyond ceiling', () => {
  const estimate = estimateSchoolPrice({
    categoryCodeOrName: 'calculator',
    condition: 'good_85',
    originalRetailPrice: 400000,
  });

  const valid = validateInputPrice(180000, estimate);
  assert.equal(valid.isValid, true);

  const invalid = validateInputPrice(350000, estimate);
  assert.equal(invalid.isValid, false);
  assert.match(invalid.warningMessage || '', /vượt quá mức giá trần/);
});
