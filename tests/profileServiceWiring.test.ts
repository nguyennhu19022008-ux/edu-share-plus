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

test('profile privacy mutation uses only the trusted RPC and parses its response', () => {
  assert.match(source, /rpc\(['"]update_my_profile_privacy['"]/, 'privacy writes must use the trusted RPC');
  assert.match(source, /parseProfilePrivacyResponse\s*\(/, 'privacy RPC responses must be strictly parsed');
  assert.doesNotMatch(source, /from\(['"]profiles['"]\)[\s\S]*\.update\s*\(/, 'profile service must not directly update profiles');
  assert.doesNotMatch(source, /from\(['"]profile_private['"]\)[\s\S]*\.update\s*\(/, 'profile service must not directly update profile_private');
});
