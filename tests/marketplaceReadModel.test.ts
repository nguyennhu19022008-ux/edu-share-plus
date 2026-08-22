import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMarketplaceRpcArgs,
  parseMarketplaceDetailResponse,
  parseMarketplaceReadResponse,
} from '../src/features/marketplace/marketplaceReadModel';

test('maps UI query values to trusted marketplace RPC payload', () => {
  assert.deepEqual(buildMarketplaceRpcArgs({
    keyword: '  sách toán  ',
    tradeType: 'Bán giá rẻ',
    categoryId: 'category-1',
    classId: '',
    sort: 'priceAsc',
    page: 2,
    pageSize: 12,
  }), {
    p_keyword: 'sách toán',
    p_trade_type: 'low_price_sale',
    p_category_id: 'category-1',
    p_class_id: null,
    p_sort: 'priceAsc',
    p_page: 2,
    p_page_size: 12,
  });
});

test('normalizes server feed rows without inventing rank or AI scores', () => {
  const result = parseMarketplaceReadResponse({
    items: [{
      id: 'post-1', schoolId: 'school-1', classId: null, categoryId: 'category-1',
      title: 'Sách Toán 11', description: 'Sách còn mới và sạch.', tradeType: 'give', price: null,
      visibilityScope: 'network', publishedAt: '2026-08-21T05:34:00+00:00', createdAt: '2026-08-21T05:34:00+00:00',
      categoryCode: 'book', categoryName: 'Sách', ownerName: 'Học sinh EDU SHARE+', className: null,
      hasImage: false, favoriteCount: 3, ownerReputationScore: 7.5, ownerReputationLabel: 'Tốt',
    }],
    totalCount: 1, page: 1, pageSize: 12, totalPages: 1,
    stats: { totalOpen: 1, free: 1, sale: 0, hasImage: 0 },
    classes: [], categories: [{ id: 'category-1', code: 'book', name: 'Sách' }],
  });

  assert.equal(result.items[0].tradeType, 'Cho tặng');
  assert.equal(result.items[0].price, 0);
  assert.equal(result.items[0].name, 'Học sinh EDU SHARE+');
  assert.equal(result.items[0].className, 'Không công khai');
  assert.equal(result.items[0].date, '21/08/2026 12:34');
  assert.equal(result.items[0].dateTs, Date.parse('2026-08-21T05:34:00+00:00'));
  assert.equal('rankScore' in result.items[0], false);
  assert.equal('aiScore' in result.items[0], false);
  assert.deepEqual(result.categories, [{ id: 'category-1', code: 'book', name: 'Sách' }]);
});

test('normalizes empty feed response', () => {
  const result = parseMarketplaceReadResponse({
    items: [], totalCount: 0, page: 1, pageSize: 12, totalPages: 0,
    stats: { totalOpen: 0, free: 0, sale: 0, hasImage: 0 }, classes: [], categories: [],
  });
  assert.deepEqual(result.items, []);
  assert.equal(result.totalPages, 0);
});

test('maps detail response including current viewer state and rejects malformed server responses', () => {
  const rawPost = {
    id: 'post-2', schoolId: 'school-1', classId: 'class-1', categoryId: 'category-1',
    title: 'Máy tính cầm tay', description: 'Hoạt động bình thường.', tradeType: 'low_price_sale', price: 120000,
    visibilityScope: 'school', publishedAt: '2026-08-21T05:34:00+00:00', createdAt: '2026-08-21T05:34:00+00:00',
    categoryCode: 'small_electronics', categoryName: 'Đồ điện tử nhỏ', ownerName: 'Nguyễn A', className: '11A04',
    hasImage: true, favoriteCount: 5, ownerReputationScore: 8.2, ownerReputationLabel: 'Rất tốt', commentsEnabled: true,
  };
  const detail = parseMarketplaceDetailResponse({
    post: rawPost,
    similarPosts: [],
    viewerSaved: true,
    viewerOwnsPost: false,
  });
  assert.equal(detail.post.tradeType, 'Bán giá rẻ');
  assert.equal(detail.post.price, 120000);
  assert.equal(detail.commentsEnabled, true);
  assert.equal(detail.viewerSaved, true);
  assert.equal(detail.viewerOwnsPost, false);

  assert.throws(() => parseMarketplaceReadResponse({ items: 'not-an-array' }), /MARKETPLACE_RESPONSE_INVALID/);
  assert.throws(() => parseMarketplaceDetailResponse({ post: null }), /MARKETPLACE_RESPONSE_INVALID/);
  assert.throws(() => parseMarketplaceDetailResponse({ post: rawPost, similarPosts: [], viewerOwnsPost:false }), /MARKETPLACE_RESPONSE_INVALID/);
  assert.throws(() => parseMarketplaceDetailResponse({ post: rawPost, similarPosts: [], viewerSaved:true }), /MARKETPLACE_RESPONSE_INVALID/);
});
