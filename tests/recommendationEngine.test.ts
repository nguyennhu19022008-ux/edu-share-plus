import assert from 'node:assert/strict';
import test from 'node:test';
import { generateRecommendations } from '../src/features/recommendations/recommendationService';

test('generateRecommendations prioritizes items matching student grade level', () => {
  const samplePosts = [
    { id: '1', title: 'Sách giáo khoa Lớp 10 Kết nối tri thức', tradeType: 'give', price: 0, className: '10A1' },
    { id: '2', title: 'Máy tính Casio fx 580', tradeType: 'sale', price: 150000, className: '11A2' },
    { id: '3', title: 'Sách Toán Lớp 12 ôn thi THPT', tradeType: 'give', price: 0, className: '12A3' },
  ];

  const recs = generateRecommendations(samplePosts, { gradeLevel: '10' });

  assert.equal(recs.length, 3);
  assert.equal(recs[0].id, '1');
  assert.equal(recs[0].explanationTag, 'Dành cho Khối 10');
});
