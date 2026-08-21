import assert from 'node:assert/strict';
import test from 'node:test';
import {
  loadMarketplaceDetail,
  readRequestedMarketplacePostId,
} from '../src/features/marketplace/marketplaceDetailPageModel';
import type { MarketplaceDetailResponse } from '../src/features/marketplace/marketplaceReadModel';

const DETAIL: MarketplaceDetailResponse = {
  post: {
    id:'post-visible-1',
    title:'Bộ sách tham khảo',
    description:'Còn tốt',
    name:'Nguyễn Văn A',
    className:'11A4',
    tradeType:'Cho tặng',
    category:'Sách',
    price:0,
    date:'21/08/2026 10:30',
    dateTs:1787283000000,
    hasImage:false,
    favoriteCount:2,
    ownerReputationScore:5,
    ownerReputationLabel:'Bình thường',
  },
  similarPosts:[],
  commentsEnabled:true,
};

test('reads the requested post id from the detail route query', () => {
  assert.equal(readRequestedMarketplacePostId('?page=detail&id=post-visible-1'), 'post-visible-1');
  assert.equal(readRequestedMarketplacePostId('?page=detail&id=%20%20'), null);
  assert.equal(readRequestedMarketplacePostId('?page=detail'), null);
});

test('loads the exact requested post through the supplied trusted detail loader', async () => {
  const calls:string[] = [];
  const state = await loadMarketplaceDetail('  post-visible-1  ', async (postId) => {
    calls.push(postId);
    return DETAIL;
  });

  assert.deepEqual(calls, ['post-visible-1']);
  assert.equal(state.status, 'ready');
  if (state.status === 'ready') assert.equal(state.detail.post.id, 'post-visible-1');
});

test('missing id becomes not-found without calling the backend', async () => {
  let called = false;
  const state = await loadMarketplaceDetail('   ', async () => {
    called = true;
    return DETAIL;
  });
  assert.equal(called, false);
  assert.deepEqual(state, { status:'notFound' });
});

test('invisible or missing backend detail is normalized to not-found', async () => {
  const state = await loadMarketplaceDetail('hidden-post', async () => {
    throw new Error('Không thể tải dữ liệu chợ học tập (P0001): EDU_SHARE_MARKETPLACE_POST_NOT_FOUND');
  });
  assert.deepEqual(state, { status:'notFound' });
});

test('unexpected backend failure becomes a retryable safe UI error', async () => {
  const state = await loadMarketplaceDetail('post-visible-1', async () => {
    throw new Error('network unavailable');
  });
  assert.deepEqual(state, {
    status:'error',
    message:'Không thể tải chi tiết bài đăng. Vui lòng thử lại.',
  });
});
