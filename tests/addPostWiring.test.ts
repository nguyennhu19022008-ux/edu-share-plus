import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync('src/pages/AddPostPage.tsx', 'utf8');

test('AddPostPage loads live owner-post reference options and creates through the trusted service', () => {
  assert.match(source, /loadOwnerPostReferenceOptions/);
  assert.match(source, /createMyPost/);
  assert.doesNotMatch(source, /useDataAccess|ownerPosts\.insert/);
  assert.match(source, /categoryId/);
  assert.match(source, /visibilityScope/);
  assert.match(source, /preferredContactMethod/);
});

test('AddPostPage collects structured low-price-sale inputs without arbitrary contact PII', () => {
  for (const field of [
    'salePrice',
    'originalPurchasePrice',
    'originalPriceIsEstimate',
    'purchaseDate',
    'conditionGrade',
    'brand',
    'model',
  ]) {
    assert.match(source, new RegExp(field));
  }
  assert.match(source, /low_price_sale/);
  assert.doesNotMatch(source, /contactInfo/);
});

test('AddPostPage keeps media persistence deferred to Phase 5F and routes with the server id', () => {
  assert.match(source, /Phase 5F/);
  assert.doesNotMatch(source, /URL\.createObjectURL|ownerPosts|LOCAL-NEW/);
  assert.match(source, /navigateLegacy\(['"]myDetail['"],\s*\{\s*id\s*:\s*result\.id\s*\}\)/);
});
