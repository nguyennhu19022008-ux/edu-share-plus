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

test('generateRecommendations supports UI Vietnamese tradeType labels and extracts grade from className', () => {
  const uiPosts = [
    { id: 'a', title: 'Bút bi xanh thiên long', tradeType: 'Trao đổi', price: 0, className: '10A1' },
    { id: 'b', title: 'Vở ô ly mới tinh', tradeType: 'Cho tặng', price: 0, className: '10A2' },
    { id: 'c', title: 'Đề cương ôn tập Hóa 11', tradeType: 'Cho mượn', price: 0, className: '11B4' },
  ];

  const recs = generateRecommendations(uiPosts, { className: '11A04' });
  assert.equal(recs.length, 3);
  assert.equal(recs[0].id, 'c');
  assert.equal(recs[0].explanationTag, 'Dành cho Khối 11');
  assert.equal(recs[1].id, 'b');
  assert.equal(recs[1].explanationTag, 'Tặng 0 đồng');
  assert.equal(recs[2].id, 'a');
  assert.equal(recs[2].explanationTag, 'Trao đổi học liệu');

  assert.deepEqual(generateRecommendations([], { className: '11A04' }), []);
});

test('generateRecommendations does not falsely match grade 10 against class 12A10 or quantities like 100 trang / 10.000đ', () => {
  const posts = [
    {
      id: 'false-class-12a10',
      title: 'Sách ôn thi THPT Quốc gia',
      tradeType: 'Bán giá rẻ',
      price: 30000,
      className: '12A10',
    },
    {
      id: 'false-qty-100',
      title: 'Vở ô ly 100 trang giá 10.000đ',
      tradeType: 'Bán giá rẻ',
      price: 10000,
      className: '11A02',
    },
    {
      id: 'true-grade-10',
      title: 'Đề cương Toán 10 học kỳ 1',
      tradeType: 'Bán giá rẻ',
      price: 15000,
      className: 'Không công khai',
    },
  ];

  const recs = generateRecommendations(posts, { className: '10A01' });
  const byId = new Map(recs.map((item) => [item.id, item]));

  assert.equal(byId.get('true-grade-10')?.explanationTag, 'Dành cho Khối 10');
  assert.notEqual(byId.get('false-class-12a10')?.explanationTag, 'Dành cho Khối 10');
  assert.notEqual(byId.get('false-qty-100')?.explanationTag, 'Dành cho Khối 10');
  assert.equal(recs[0].id, 'true-grade-10');
});


