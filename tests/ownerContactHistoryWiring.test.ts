import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync('src/pages/MyDetailPage.tsx', 'utf8');

test('MyDetailPage loads trusted owner contact history and favorite aggregate', () => {
  assert.match(source, /listMyPostContactEvents\s*\(/, 'owner detail must load the trusted contact audit projection');
  assert.match(source, /Hoạt động liên hệ/, 'owner detail must label the audited contact activity section');
  assert.match(source, /favoriteCount/, 'owner detail must render the aggregate favorite count');
  assert.doesNotMatch(source, /Lượt lưu, yêu cầu liên hệ, bình luận và báo cáo sẽ được nối ở Phase 5G\/5H/, 'old Phase 5G interaction placeholder must be removed');
});

test('owner interaction presentation never consumes requester contact PII or favorite identities', () => {
  assert.doesNotMatch(source, /contact_email|contact_phone|profile_private/i, 'owner detail must not read requester private contact values');
  assert.doesNotMatch(source, /favoriteUser|favoritedBy|favoriteUsers/i, 'owner detail must not render favorite-user identities');
  assert.match(source, /requesterName/, 'owner contact rows use the backend-masked requester name');
  assert.match(source, /requesterClassName/, 'owner contact rows may render the backend-masked requester class');
  assert.match(source, /revealedMethod/, 'owner history may display only which contact method was revealed');
});

test('interaction history failure remains scoped from truthful owner post detail', () => {
  assert.match(source, /interactionHistoryError/, 'owner interaction history needs an independent error state');
  assert.match(source, /interactionHistoryLoading/, 'owner interaction history needs an independent loading state');
});
