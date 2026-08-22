import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseCommentDeleteResponse,
  parseCommentListResponse,
  parseCommentMutationResponse,
  parseContactRevealResponse,
  parseOwnerContactHistoryResponse,
  parseSavedPostListResponse,
} from '../src/features/interactions/interactionModel';

const ROOT_ID = '00000000-0000-0000-0000-000000000001';
const REPLY_ID = '00000000-0000-0000-0000-000000000002';
const POST_ID = '00000000-0000-0000-0000-000000000003';
const EVENT_ID = '00000000-0000-0000-0000-000000000004';
const CREATED_AT = '2026-08-22T08:00:00Z';

test('parses a comment projection including deleted-root tombstones', () => {
  const parsed = parseCommentListResponse({
    items:[
      {
        id:ROOT_ID,
        parentId:null,
        body:null,
        isDeleted:true,
        authorName:'Học sinh EDU SHARE+',
        authorClassName:null,
        createdAt:CREATED_AT,
        canDelete:false,
      },
      {
        id:REPLY_ID,
        parentId:ROOT_ID,
        body:'Phản hồi hợp lệ',
        isDeleted:false,
        authorName:'Nguyễn Văn A',
        authorClassName:'11A2',
        createdAt:'2026-08-22T08:01:00Z',
        canDelete:true,
      },
    ],
    totalCount:2,
  });

  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].body, null);
  assert.equal(parsed[0].isDeleted, true);
  assert.equal(parsed[1].parentId, ROOT_ID);
  assert.equal(parsed[1].authorClassName, '11A2');
});

test('rejects malformed comment projections instead of coercing them', () => {
  assert.throws(
    () => parseCommentListResponse({ items:[{ id:'x', body:42 }], totalCount:1 }),
    /INTERACTION_RESPONSE_INVALID/,
  );
  assert.throws(
    () => parseCommentListResponse({
      items:[{
        id:ROOT_ID,
        parentId:null,
        body:'deleted body must not leak',
        isDeleted:true,
        authorName:'Học sinh',
        authorClassName:null,
        createdAt:CREATED_AT,
        canDelete:false,
      }],
      totalCount:1,
    }),
    /INTERACTION_RESPONSE_INVALID/,
  );
  assert.throws(
    () => parseCommentListResponse({ items:[], totalCount:-1 }),
    /INTERACTION_RESPONSE_INVALID/,
  );
});

test('parses comment create and soft-delete responses strictly', () => {
  assert.deepEqual(parseCommentMutationResponse({
    id:ROOT_ID,
    postId:POST_ID,
    parentId:null,
    createdAt:CREATED_AT,
  }), {
    id:ROOT_ID,
    postId:POST_ID,
    parentId:null,
    createdAt:CREATED_AT,
  });

  assert.deepEqual(parseCommentDeleteResponse({
    id:ROOT_ID,
    deletedAt:'2026-08-22T08:05:00Z',
    alreadyDeleted:false,
  }), {
    id:ROOT_ID,
    deletedAt:'2026-08-22T08:05:00Z',
    alreadyDeleted:false,
  });

  assert.throws(
    () => parseCommentMutationResponse({ id:'bad', postId:POST_ID, parentId:null, createdAt:CREATED_AT }),
    /INTERACTION_RESPONSE_INVALID/,
  );
  assert.throws(
    () => parseCommentDeleteResponse({ id:ROOT_ID, deletedAt:'not-a-date', alreadyDeleted:false }),
    /INTERACTION_RESPONSE_INVALID/,
  );
});

test('parses exactly one audited contact channel', () => {
  assert.deepEqual(parseContactRevealResponse({
    method:'email',
    value:'student@example.test',
    eventId:EVENT_ID,
    eventCreatedAt:CREATED_AT,
    eventReused:false,
  }), {
    method:'email',
    value:'student@example.test',
    eventId:EVENT_ID,
    eventCreatedAt:CREATED_AT,
    eventReused:false,
  });

  assert.throws(
    () => parseContactRevealResponse({ method:'email', value:'x', eventId:'bad' }),
    /INTERACTION_RESPONSE_INVALID/,
  );
  assert.throws(
    () => parseContactRevealResponse({
      method:'zalo', value:'student@example.test', eventId:EVENT_ID,
      eventCreatedAt:CREATED_AT, eventReused:false,
    }),
    /INTERACTION_RESPONSE_INVALID/,
  );
  assert.throws(
    () => parseContactRevealResponse({
      method:'phone', value:'', eventId:EVENT_ID,
      eventCreatedAt:CREATED_AT, eventReused:false,
    }),
    /INTERACTION_RESPONSE_INVALID/,
  );
});

test('parses owner contact history with masked identity and aggregate favorite count', () => {
  const parsed = parseOwnerContactHistoryResponse({
    items:[{
      id:EVENT_ID,
      requesterName:'Học sinh EDU SHARE+',
      requesterClassName:null,
      revealedMethod:'phone',
      createdAt:CREATED_AT,
    }],
    totalCount:1,
    favoriteCount:7,
  });

  assert.equal(parsed.items[0].requesterClassName, null);
  assert.equal(parsed.items[0].revealedMethod, 'phone');
  assert.equal(parsed.totalCount, 1);
  assert.equal(parsed.favoriteCount, 7);

  assert.throws(
    () => parseOwnerContactHistoryResponse({ items:[], totalCount:0, favoriteCount:1.5 }),
    /INTERACTION_RESPONSE_INVALID/,
  );
});

test('parses saved posts with nullable price and publish time', () => {
  const parsed = parseSavedPostListResponse({
    items:[{
      id:POST_ID,
      title:'Sách Vật lý 11',
      tradeType:'give',
      categoryName:'Sách',
      price:null,
      publishedAt:null,
      createdAt:CREATED_AT,
      favoriteCount:3,
    }],
    totalCount:1,
    limit:20,
    offset:0,
  });

  assert.equal(parsed.items[0].price, null);
  assert.equal(parsed.items[0].publishedAt, null);
  assert.equal(parsed.items[0].tradeType, 'give');
  assert.equal(parsed.items[0].favoriteCount, 3);

  assert.throws(
    () => parseSavedPostListResponse({
      items:[{
        id:POST_ID, title:'X', tradeType:'unknown', categoryName:'Sách', price:null,
        publishedAt:null, createdAt:CREATED_AT, favoriteCount:0,
      }],
      totalCount:1, limit:20, offset:0,
    }),
    /INTERACTION_RESPONSE_INVALID/,
  );
  assert.throws(
    () => parseSavedPostListResponse({ items:[], totalCount:0, limit:0, offset:0 }),
    /INTERACTION_RESPONSE_INVALID/,
  );
});
