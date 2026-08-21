import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildOwnerPostMutationArgs,
  parseOwnerPostRow,
  parseOwnerWriteResponse,
} from '../src/features/my-posts/ownerPostModel';

const postId = '11111111-1111-4111-8111-111111111111';
const categoryId = '22222222-2222-4222-8222-222222222222';
const classId = '33333333-3333-4333-8333-333333333333';

const baseRow = {
  id:postId,
  title:'Máy tính cầm tay còn tốt',
  description:'Máy dùng tốt, phù hợp cho học sinh ôn tập.',
  trade_type:'low_price_sale',
  sale_price:70000,
  moderation_status:'rejected',
  lifecycle_status:'active',
  visibility_scope:'school',
  preferred_contact_method:'phone',
  original_purchase_price:180000,
  original_price_is_estimate:false,
  purchase_date:'2025-09-01',
  condition_grade:'good',
  brand:'Casio',
  model:'fx-580VN X',
  is_hidden:false,
  comments_enabled:true,
  created_at:'2026-08-21T02:00:00.000Z',
  updated_at:'2026-08-21T03:30:00.000Z',
  published_at:null,
  completed_at:null,
  withdrawn_at:null,
  category:{ id:categoryId, name:'Đồ điện tử nhỏ' },
  class:{ id:classId, label:'11A4' },
};

test('maps a real owner post without inventing interaction metrics', () => {
  const mapped = parseOwnerPostRow(baseRow);
  assert.equal(mapped.id, postId);
  assert.equal(mapped.tradeType, 'low_price_sale');
  assert.equal(mapped.tradeLabel, 'Bán giá rẻ');
  assert.equal(mapped.moderationStatus, 'rejected');
  assert.equal(mapped.moderationLabel, 'Từ chối');
  assert.equal(mapped.lifecycleStatus, 'active');
  assert.equal(mapped.lifecycleLabel, 'Đang hoạt động');
  assert.equal(mapped.categoryId, categoryId);
  assert.equal(mapped.categoryName, 'Đồ điện tử nhỏ');
  assert.equal(mapped.classId, classId);
  assert.equal(mapped.className, '11A4');
  assert.equal(mapped.salePrice, 70000);
  assert.equal(mapped.salePriceLabel, '70.000 ₫');
  assert.equal(mapped.originalPurchasePrice, 180000);
  assert.equal(mapped.conditionGrade, 'good');
  assert.equal(mapped.conditionLabel, 'Tốt');
  assert.equal(mapped.createdAtLabel, '21/08/2026 09:00');
  assert.equal(mapped.updatedAtLabel, '21/08/2026 10:30');
  assert.ok(!('favoriteCount' in mapped));
  assert.ok(!('contactViewCount' in mapped));
  assert.ok(!('commentCount' in mapped));
  assert.ok(!('reportCount' in mapped));
  assert.ok(!('effectiveness' in mapped));
});

test('maps nullable class and non-sale structured fields truthfully', () => {
  const mapped = parseOwnerPostRow({
    ...baseRow,
    trade_type:'give',
    sale_price:null,
    original_purchase_price:null,
    original_price_is_estimate:null,
    purchase_date:null,
    condition_grade:null,
    brand:null,
    model:null,
    moderation_status:'pending',
    visibility_scope:'inherit',
    preferred_contact_method:'email',
    class:null,
  });
  assert.equal(mapped.classId, null);
  assert.equal(mapped.className, 'Toàn trường');
  assert.equal(mapped.salePrice, null);
  assert.equal(mapped.salePriceLabel, 'Miễn phí / thỏa thuận');
  assert.equal(mapped.conditionGrade, null);
  assert.equal(mapped.conditionLabel, 'Không áp dụng');
});

test('strictly rejects malformed enum and timestamp payloads', () => {
  assert.throws(() => parseOwnerPostRow({ ...baseRow, moderation_status:'published' }), /OWNER_POST_RESPONSE_INVALID/);
  assert.throws(() => parseOwnerPostRow({ ...baseRow, created_at:'not-a-date' }), /OWNER_POST_RESPONSE_INVALID/);
  assert.throws(() => parseOwnerPostRow({ ...baseRow, sale_price:'70000' }), /OWNER_POST_RESPONSE_INVALID/);
});

test('builds trusted RPC arguments without owner, school, class or moderation inputs', () => {
  const args = buildOwnerPostMutationArgs({
    categoryId,
    title:'Máy tính cầm tay còn tốt',
    description:'Máy dùng tốt, phù hợp cho học sinh ôn tập.',
    tradeType:'low_price_sale',
    salePrice:70000,
    visibilityScope:'school',
    preferredContactMethod:'phone',
    originalPurchasePrice:180000,
    originalPriceIsEstimate:false,
    purchaseDate:'2025-09-01',
    conditionGrade:'good',
    brand:' Casio ',
    model:' fx-580VN X ',
  });
  assert.deepEqual(args, {
    p_category_id:categoryId,
    p_title:'Máy tính cầm tay còn tốt',
    p_description:'Máy dùng tốt, phù hợp cho học sinh ôn tập.',
    p_trade_type:'low_price_sale',
    p_sale_price:70000,
    p_visibility_scope:'school',
    p_preferred_contact_method:'phone',
    p_original_purchase_price:180000,
    p_original_price_is_estimate:false,
    p_purchase_date:'2025-09-01',
    p_condition_grade:'good',
    p_brand:'Casio',
    p_model:'fx-580VN X',
  });
  assert.ok(!('owner_id' in args));
  assert.ok(!('school_id' in args));
  assert.ok(!('class_id' in args));
  assert.ok(!('moderation_status' in args));
  assert.ok(!('is_hidden' in args));
});

test('parses the minimal server-authoritative write response', () => {
  assert.deepEqual(parseOwnerWriteResponse({
    id:postId,
    moderationStatus:'pending',
    lifecycleStatus:'active',
    visibilityScope:'school',
    updatedAt:'2026-08-21T03:30:00.000Z',
  }), {
    id:postId,
    moderationStatus:'pending',
    lifecycleStatus:'active',
    visibilityScope:'school',
    updatedAt:'2026-08-21T03:30:00.000Z',
  });
  assert.throws(() => parseOwnerWriteResponse({ id:postId, moderationStatus:'approved' }), /OWNER_POST_RESPONSE_INVALID/);
});
