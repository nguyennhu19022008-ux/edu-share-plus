import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const pageSource = readFileSync('src/pages/ProfilePage.tsx', 'utf8');
const sectionsSource = readFileSync('src/features/profile/components/ProfileSections.tsx', 'utf8');
const headerSource = readFileSync('src/components/student/StudentHeader.tsx', 'utf8');

test('ProfilePage loads and saves profile data through the real Supabase profile service', () => {
  assert.match(pageSource, /getMyProfile\s*\(/, 'ProfilePage must load the current profile through getMyProfile()');
  assert.match(pageSource, /updateMyProfilePrivacy\s*\(/, 'ProfilePage must save privacy through the trusted RPC service');
  for (const forbidden of [
    /useDataAccess/,
    /profileRepository/,
    /getBundle\s*\(/,
    /updateImages\s*\(/,
    /recordPasswordChanged\s*\(/,
  ]) {
    assert.doesNotMatch(pageSource, forbidden, `ProfilePage must not keep mock profile dependency ${forbidden}`);
  }
});

test('ProfilePage keeps deferred image, saved-post and notification features truthful', () => {
  assert.doesNotMatch(pageSource, /URL\.createObjectURL\s*\(/, 'ProfilePage must not simulate persisted profile images');
  assert.doesNotMatch(pageSource, /<ProfileUploadBox/, 'profile uploads remain unavailable until Phase 5F');
  assert.doesNotMatch(pageSource, /<SavedPostsSection/, 'saved posts remain unavailable until Phase 5G');
  assert.doesNotMatch(pageSource, /<NotificationsSection/, 'notifications remain unavailable until Phase 5H');
  assert.match(pageSource, /Phase 5F/, 'image deferral must be explicit to users');
  assert.match(pageSource, /Phase 5G/, 'saved-post deferral must be explicit to users');
  assert.match(pageSource, /Phase 5H/, 'notification deferral must be explicit to users');
});

test('real profile presentation uses StudentProfileView without fabricated activity or reputation detail', () => {
  assert.match(sectionsSource, /StudentProfileView/, 'real profile sections must consume StudentProfileView');
  assert.doesNotMatch(sectionsSource, /profile\.activity/, 'real profile sections must not display mock activity counters');
  assert.doesNotMatch(sectionsSource, /profile\.reputation\.detail/, 'real profile sections must not invent reputation detail');
});

test('StudentHeader no longer reads mock profile or notification data', () => {
  assert.doesNotMatch(headerSource, /useDataAccess/, 'StudentHeader must not read DataAccess profile mocks');
  assert.doesNotMatch(headerSource, /getBundle\s*\(/, 'StudentHeader must not read mock profile bundles');
  assert.match(headerSource, /notifications\s*\?\?\s*\[\]/, 'header notifications must default to an empty real-data state');
});

test('ProfilePage submits password changes through the real Auth path after form validation', () => {
  assert.match(pageSource, /changeMyPassword\s*\(/, 'ProfilePage must call changeMyPassword()');
  assert.match(pageSource, /validateProfilePasswordChange\s*\(/, 'ProfilePage must validate current/new/confirmation before mutation');
  assert.doesNotMatch(pageSource, /recordPasswordChanged|mô phỏng đổi mật khẩu local/, 'ProfilePage must not simulate password changes');
});
