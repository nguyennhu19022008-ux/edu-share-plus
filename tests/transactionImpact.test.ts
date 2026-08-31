import assert from 'node:assert/strict';
import test from 'node:test';
import { estimateItemImpact, IMPACT_BENCHMARKS, formatVnd } from '../src/features/transactions/impactCalculator';

test('estimateItemImpact calculates financial savings and waste reduction for textbook giveaway', () => {
  const result = estimateItemImpact('textbook', 'give', 0);
  assert.equal(result.financialSaved, 50000);
  assert.equal(result.wasteReducedKg, 0.45);
  assert.match(result.description, /Tiết kiệm ước tính 50\.000đ/);
});

test('estimateItemImpact calculates reduced savings for discounted sale', () => {
  const result = estimateItemImpact('calculator', 'sale', 100000);
  assert.equal(result.financialSaved, 250000); // 350000 - 100000
  assert.equal(result.wasteReducedKg, 0.25);
});

test('estimateItemImpact calculates loan as half savings', () => {
  const result = estimateItemImpact('uniform', 'loan', 0);
  assert.equal(result.financialSaved, 60000); // 120000 / 2
  assert.equal(result.wasteReducedKg, 0.75);
});

test('formatVnd formats Vietnamese currency correctly', () => {
  assert.equal(formatVnd(50000), '50.000đ');
  assert.equal(formatVnd(1250000), '1.250.000đ');
});
