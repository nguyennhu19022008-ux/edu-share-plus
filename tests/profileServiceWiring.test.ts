import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync('src/features/profile/profileService.ts', 'utf8');

test('profile service reads the signed-in identity and self profile rows through Supabase', () => {
  assert.match(source, /auth\.getUser\s*\(/, 'profile service must resolve the current Auth user');
  assert.match(source, /from\(['"]profiles['"]\)/, 'profile service must read public.profiles');
  assert.match(source, /from\(['"]profile_private['"]\)/, 'profile service must read public.profile_private');
  assert.match(source, /from\(['"]school_classes['"]\)/, 'profile service must resolve the class label from school_classes');
  assert.match(source, /parseStudentProfileView\s*\(/, 'profile service must pass backend data through the strict profile mapper');
  assert.doesNotMatch(source, /getProfileBundleLocal|getBundle|profileRepository/, 'profile service must never fall back to local profile mocks');
});

test('profile service resolves only the self avatar through private signed storage', () => {
  assert.match(source, /parseAvatarFileId\s*\(\s*profile\.avatar_file_id\s*\)/, 'avatar_file_id must pass through the strict profile parser');
  assert.match(source, /getMyAvatarSignedUrl\s*\(/, 'profile service must resolve avatar media through the private media service');
  assert.match(source, /avatarUrl/, 'resolved signed avatar URL must be copied into the transient profile view');
  assert.doesNotMatch(source, /getMyAvatarSignedUrl\s*\(\s*privateProfile\.face_file_id/, 'face_file_id must not be treated as an avatar or biometric upload flow');
  assert.doesNotMatch(source, /getPublicUrl|service_role|auth\.admin/, 'profile media reads must not bypass private Storage or use admin secrets');
});

test('profile privacy mutation uses only the trusted RPC and parses its response', () => {
  assert.match(source, /rpc\(['"]update_my_profile_privacy['"]/, 'privacy writes must use the trusted RPC');
  assert.match(source, /parseProfilePrivacyResponse\s*\(/, 'privacy RPC responses must be strictly parsed');
  assert.doesNotMatch(source, /from\(['"]profiles['"]\)[\s\S]*\.update\s*\(/, 'profile service must not directly update profiles');
  assert.doesNotMatch(source, /from\(['"]profile_private['"]\)[\s\S]*\.update\s*\(/, 'profile service must not directly update profile_private');
});

test('profile password change verifies the current password explicitly before mutation', () => {
  assert.match(source, /export\s+async\s+function\s+changeMyPassword/, 'profile service must expose changeMyPassword()');
  assert.match(source, /auth\.getUser\s*\(/, 'password change must resolve the authenticated email first');
  assert.match(source, /auth\.signInWithPassword\s*\(/, 'password change must verify the current password through a password sign-in');
  assert.match(source, /email\s*:\s*user\.email/, 'current-password verification must use the authenticated user email');
  assert.match(source, /password\s*:\s*input\.currentPassword/, 'current password must be supplied only to signInWithPassword()');
  assert.match(source, /auth\.updateUser\s*\(/, 'verified password mutation must use Supabase Auth updateUser()');
  assert.match(source, /password\s*:\s*input\.newPassword/, 'new password must be passed to Supabase Auth');
  assert.doesNotMatch(source, /current_password\s*:/, 'password mutation must not depend on a hosted-only current-password enforcement toggle');
  assert.doesNotMatch(source, /service_role|auth\.admin/, 'browser profile service must not use admin/service-role Auth APIs');
});
