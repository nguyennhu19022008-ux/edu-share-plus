import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { deriveMarketplacePageState } from '../src/features/marketplace/marketplacePageModel';

const marketplacePageSource = readFileSync('src/pages/MarketplacePage.tsx', 'utf8');

test('MarketplacePage enables live Reputation Ranking and AI Recommendations instead of Phase 6 deferral placeholder', () => {
  assert.doesNotMatch(
    marketplacePageSource,
    /Xếp hạng uy tín và gợi ý AI sẽ được bật ở Phase 6/,
    'Deferred Phase 6 placeholder must be removed from MarketplacePage.tsx',
  );
  assert.match(marketplacePageSource, /Bật xếp hạng theo uy tín/);
  assert.match(marketplacePageSource, /Bật gợi ý AI/);
  assert.match(marketplacePageSource, /<MarketplaceSmartStrip/);
});

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
  assert.deepEqual(state.smartPosts, []);
});

test('ranks marketplace posts by reputation and engagement when smartMode is rank', () => {
  const lowRepPost = {
    ...post,
    id: 'post-low',
    title: 'Vở ghi cũ',
    tradeType: 'Bán giá rẻ' as const,
    price: 30000,
    hasImage: false,
    favoriteCount: 0,
    ownerReputationScore: 5.2,
    ownerReputationLabel: 'Khá',
  };
  const highRepPost = {
    ...post,
    id: 'post-high',
    title: 'Bộ sách giáo khoa Toán 11',
    tradeType: 'Cho tặng' as const,
    price: 0,
    hasImage: true,
    favoriteCount: 8,
    ownerReputationScore: 9.2,
    ownerReputationLabel: 'Rất tốt',
  };

  const state = deriveMarketplacePageState(
    {
      items: [lowRepPost, highRepPost],
      totalCount: 2,
      page: 1,
      pageSize: 12,
      totalPages: 1,
      stats: { totalOpen: 2, free: 1, sale: 1, hasImage: 1 },
      classes: [{ id: 'class-1', label: '11A04' }],
      categories: [{ id: 'category-1', code: 'book', name: 'Sách' }],
    },
    { smartMode: 'rank', studentClassLabel: '11A04' },
  );

  assert.equal(state.posts.length, 2);
  assert.equal(state.posts[0].id, 'post-high');
  assert.equal(state.posts[1].id, 'post-low');
  assert.ok(state.smartPosts[0].rankScore > state.smartPosts[1].rankScore);
  assert.equal(state.smartPosts[0].reputationBadgeLabel, 'Đại sứ chia sẻ uy tín');
  assert.match(state.smartPosts[0].recommendationReason, /Đại sứ chia sẻ uy tín/);
});

test('prioritizes grade-matching and zero-cost items when smartMode is ai', () => {
  const grade12Sale = {
    ...post,
    id: 'post-12',
    title: 'Sách ôn thi Vật lí 12',
    className: '12A01',
    tradeType: 'Bán giá rẻ' as const,
    price: 45000,
    ownerReputationScore: 7.5,
  };
  const grade10Match = {
    ...post,
    id: 'post-10',
    title: 'Sách giáo khoa Ngữ văn Lớp 10',
    className: '10A02',
    tradeType: 'Bán giá rẻ' as const,
    price: 25000,
    ownerReputationScore: 7.0,
  };
  const freeGift = {
    ...post,
    id: 'post-free',
    title: 'Tặng bộ thước kẻ học tập',
    className: '11A03',
    tradeType: 'Cho tặng' as const,
    price: 0,
    ownerReputationScore: 7.0,
  };

  const state = deriveMarketplacePageState(
    {
      items: [grade12Sale, freeGift, grade10Match],
      totalCount: 3,
      page: 1,
      pageSize: 12,
      totalPages: 1,
      stats: { totalOpen: 3, free: 1, sale: 2, hasImage: 0 },
      classes: [{ id: 'class-10', label: '10A02' }],
      categories: [{ id: 'category-1', code: 'book', name: 'Sách' }],
    },
    { smartMode: 'ai', studentClassLabel: '10A02' },
  );

  assert.equal(state.posts[0].id, 'post-10');
  assert.equal(state.smartPosts[0].explanationTag, 'Dành cho Khối 10');
  assert.equal(state.posts[1].id, 'post-free');
  assert.equal(state.smartPosts[1].explanationTag, 'Tặng 0 đồng');
});

test('normalizes 100-scale ownerReputationScore consistently across smartPosts and viewUtils', async () => {
  const { normalizeMarketReputationScore, marketReputationTone } = await import(
    '../src/features/marketplace/viewUtils'
  );
  const hundredScalePost = {
    ...post,
    id: 'post-68',
    ownerReputationScore: 68,
    ownerReputationLabel: 'Tốt',
  };

  const state = deriveMarketplacePageState(
    {
      items: [hundredScalePost],
      totalCount: 1,
      page: 1,
      pageSize: 12,
      totalPages: 1,
      stats: { totalOpen: 1, free: 1, sale: 0, hasImage: 0 },
      classes: [],
      categories: [],
    },
    { smartMode: 'rank' },
  );

  assert.equal(normalizeMarketReputationScore(68), 6.8);
  assert.equal(marketReputationTone(68), 'good');
  assert.equal(state.smartPosts[0].ownerReputationScore, 6.8);
  assert.match(state.smartPosts[0].recommendationReason, /\(6\.8\/10\)/);
});

test('MarketplaceSmartStrip and MarketplacePostCard render rank/ai modes, normalized 100-scale scores, and empty filter state', async () => {
  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MarketplaceSmartStrip, MarketplacePostCard } = await import(
    '../src/features/marketplace/components/MarketplaceCards'
  );

  const state = deriveMarketplacePageState(
    {
      items: [
        {
          ...post,
          id: 'post-68',
          title: 'Sách giáo khoa Toán Lớp 11',
          ownerReputationScore: 68,
          ownerReputationLabel: 'Tốt',
        },
      ],
      totalCount: 1,
      page: 1,
      pageSize: 12,
      totalPages: 1,
      stats: { totalOpen: 1, free: 1, sale: 0, hasImage: 0 },
      classes: [{ id: 'c1', label: '11A04' }],
      categories: [],
    },
    { smartMode: 'ai', studentClassLabel: '11A04' },
  );

  const aiStripHtml = renderToStaticMarkup(
    React.createElement(MarketplaceSmartStrip, {
      posts: state.smartPosts,
      mode: 'ai',
      filteredCount: state.totalCount,
      studentClassLabel: '11A04',
    }),
  );
  assert.match(aiStripHtml, /AI gợi ý học liệu phù hợp cho Lớp 11A04/);
  assert.match(aiStripHtml, /Dành cho Khối 11/);
  assert.match(aiStripHtml, /Uy tín 6\.8\/10/);

  const emptyStripHtml = renderToStaticMarkup(
    React.createElement(MarketplaceSmartStrip, {
      posts: [],
      mode: 'rank',
      filteredCount: 0,
    }),
  );
  assert.match(emptyStripHtml, /Chưa có bài đăng phù hợp để xếp hạng uy tín trong bộ lọc hiện tại/);

  const cardHtml = renderToStaticMarkup(
    React.createElement(MarketplacePostCard, {
      post: { ...post, ownerReputationScore: 68, ownerReputationLabel: 'Tốt' },
      saved: false,
      onToggleSaved: () => {},
    }),
  );
  assert.match(cardHtml, /6\.8\/10 \(Tốt\)/);
});



