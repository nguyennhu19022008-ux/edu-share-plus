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

test('AddPostPage validates and persists selected post images only after the server post exists', () => {
  assert.match(source, /validatePostMediaFiles/);
  assert.match(source, /uploadPostMedia/);
  assert.match(source, /type=["']file["']/);
  assert.match(source, /accept=["']image\/jpeg,image\/png,image\/webp["']/);
  assert.match(source, /\bmultiple\b/);
  assert.match(source, /uploadPostMedia\s*\(\s*result\.id\s*,\s*selectedFiles\s*\)/);
  assert.doesNotMatch(source, /URL\.createObjectURL|getPublicUrl|\.storage\.from\s*\(/);
  assert.match(source, /navigateLegacy\(['"]myDetail['"],\s*\{\s*id\s*:\s*result\.id\s*\}\)/);
});
