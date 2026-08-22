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

test('ProfilePage uploads only a private avatar and renders live saved posts while notifications remain deferred', () => {
  assert.match(pageSource, /uploadMyAvatar\s*\(/, 'ProfilePage must upload avatar through the private media service');
  assert.match(pageSource, /validateAvatarFile\s*\(/, 'ProfilePage must validate avatar files before upload');
  assert.match(pageSource, /type=['"]file['"]/, 'ProfilePage must expose an avatar file input');
  assert.match(pageSource, /accept=['"]image\/jpeg,image\/png,image\/webp['"]/, 'avatar input must accept only the approved MIME set');
  assert.doesNotMatch(pageSource, /URL\.createObjectURL\s*\(/, 'ProfilePage must not simulate persisted profile images');
  assert.doesNotMatch(pageSource, /face.*upload|upload.*face|biometric/i, 'Phase 5G must not open a face or biometric upload workflow');

  assert.match(pageSource, /listMySavedPosts\s*\(/, 'ProfilePage must load saved posts through the Phase 5G interaction service');
  assert.match(pageSource, /savedPosts/, 'ProfilePage must keep an explicit live saved-post state');
  assert.match(pageSource, /navigateLegacy\(['"]detail['"]\s*,\s*\{\s*id\s*:/, 'saved-post cards must navigate to the real marketplace detail route');
  assert.doesNotMatch(pageSource, /Danh sách yêu thích chưa được hiển thị|Phase 5G sẽ nối nguồn favorites thật/, 'saved-post deferral copy must be removed once Phase 5G is live');

  assert.doesNotMatch(pageSource, /<NotificationsSection/, 'notifications remain unavailable until Phase 5H');
  assert.match(pageSource, /Phase 5H/, 'notification deferral must remain explicit to users');
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

test('ProfilePage captures the password form before awaiting the Auth mutation', () => {
  assert.match(pageSource, /const\s+passwordForm\s*=\s*event\.currentTarget/, 'password handler must capture the form element before awaiting');
  assert.match(pageSource, /passwordForm\.reset\s*\(\s*\)/, 'successful password change must reset the captured form');
  assert.doesNotMatch(pageSource, /await\s+changeMyPassword[\s\S]*event\.currentTarget\.reset\s*\(/, 'password handler must not dereference event.currentTarget after await');
});
