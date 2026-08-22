import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const listSource = readFileSync('src/pages/MyPostsPage.tsx', 'utf8');
const detailSource = readFileSync('src/pages/MyDetailPage.tsx', 'utf8');

test('MyPostsPage uses paginated server reads and trusted lifecycle/create workflows', () => {
  assert.match(listSource, /listMyPosts/);
  assert.match(listSource, /changeMyPostLifecycle/);
  assert.match(listSource, /createMyPost/);
  assert.match(listSource, /moderationStatus/);
  assert.match(listSource, /lifecycleStatus/);
  assert.match(listSource, /pageSize/);
  assert.doesNotMatch(listSource, /useDataAccess|ownerPosts|ownerDetail/);
  assert.doesNotMatch(listSource, /toggleHidden|favoriteCount|contactViewCount|contactedCount|commentCount|reportCount/);
  assert.doesNotMatch(listSource, /12A1|local-ui@/);
});

test('MyDetailPage reads own detail and uses trusted owner workflows plus the 5G audit projection', () => {
  assert.match(detailSource, /getMyPost/);
  assert.match(detailSource, /changeMyPostLifecycle/);
  assert.match(detailSource, /createMyPost/);
  assert.match(detailSource, /listMyPostContactEvents/);
  assert.match(detailSource, /rejectionReason/);
  assert.match(detailSource, /moderationStatus/);
  assert.match(detailSource, /lifecycleStatus/);
  assert.match(detailSource, /favoriteCount/);
  assert.doesNotMatch(detailSource, /useDataAccess|ownerPosts|ownerDetail/);
  assert.doesNotMatch(detailSource, /toggleHidden|reportCount|buildOwnerEffectiveness|effectiveness/);
  assert.doesNotMatch(detailSource, /12A1|local-ui@/);
});

test('owner completion UI matches the backend approved-only completion contract', () => {
  assert.match(listSource, /post\.lifecycleStatus\s*===\s*['"]active['"]\s*&&\s*post\.moderationStatus\s*===\s*['"]approved['"]/);
  assert.match(detailSource, /post\.lifecycleStatus\s*===\s*['"]active['"]\s*&&\s*post\.moderationStatus\s*===\s*['"]approved['"]/);
});

test('MyDetailPage renders private signed post media and live owner contact audit without private PII', () => {
  assert.match(detailSource, /listPostMedia\s*\(/);
  assert.match(detailSource, /media\.map\s*\(/);
  assert.match(detailSource, /item\.signedUrl/);
  assert.match(detailSource, /listMyPostContactEvents\s*\(/);
  assert.match(detailSource, /Hoạt động liên hệ/);
  assert.match(detailSource, /Phase 5H/);
  assert.doesNotMatch(detailSource, /getPublicUrl|URL\.createObjectURL|\.storage\.from\s*\(/);
  assert.doesNotMatch(detailSource, /contact_email|contact_phone|profile_private/i);
  assert.doesNotMatch(detailSource, /Ảnh\/media thật sẽ được nối ở Phase 5F/);
  assert.doesNotMatch(detailSource, /Lượt lưu, yêu cầu liên hệ, bình luận và báo cáo sẽ được nối ở Phase 5G\/5H/);
});
