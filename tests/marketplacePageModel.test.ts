import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveMarketplacePageState } from '../src/features/marketplace/marketplacePageModel';

const post = {
  id:'post-1', title:'Sách', description:'Sách cũ', name:'Nguyễn A', className:'11A04',
  tradeType:'Cho tặng' as const, category:'Sách', price:0, date:'21/08/2026 12:00',
  dateTs:Date.parse('2026-08-21T05:00:00Z'), hasImage:false, favoriteCount:0,
  ownerReputationScore:7, ownerReputationLabel:'Tốt',
};

test('uses server items/count/pages directly instead of slicing a browser dataset', () => {
  const state = deriveMarketplacePageState({
    items:[post], totalCount:37, page:4, pageSize:12, totalPages:4,
    stats:{ totalOpen:37, free:12, sale:9, hasImage:20 },
    classes:[{ id:'class-1', label:'11A04' }],
    categories:[{ id:'category-1', code:'book', name:'Sách' }],
  });
  assert.deepEqual(state.posts, [post]);
  assert.equal(state.totalCount, 37);
  assert.equal(state.totalPages, 4);
  assert.equal(state.safePage, 4);
  assert.equal(state.stats.hasImage, 20);
});

test('normalizes the empty server page without inventing an extra page', () => {
  const state = deriveMarketplacePageState({
    items:[], totalCount:0, page:1, pageSize:12, totalPages:0,
    stats:{ totalOpen:0, free:0, sale:0, hasImage:0 }, classes:[], categories:[],
  });
  assert.equal(state.totalPages, 0);
  assert.equal(state.safePage, 1);
  assert.deepEqual(state.posts, []);
});
