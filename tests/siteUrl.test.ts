import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getPasswordResetRedirectUrl,
  getStudentConfirmRedirectUrl,
  PRODUCTION_SITE_URL,
  resolvePublicSiteOrigin,
} from '../src/lib/supabase/siteUrl';

test('Site URL: resolvePublicSiteOrigin returns production domain in SSR/Phone environment', () => {
  const origin = resolvePublicSiteOrigin();
  assert.ok(origin.startsWith('http'));
  assert.equal(PRODUCTION_SITE_URL, 'https://edu-share-pink.vercel.app');
});

test('Site URL: getStudentConfirmRedirectUrl formats confirmed query parameters correctly', () => {
  const urlString = getStudentConfirmRedirectUrl();
  const url = new URL(urlString);
  assert.equal(url.searchParams.get('page'), 'loginStudent');
  assert.equal(url.searchParams.get('confirmed'), '1');
});

test('Site URL: getPasswordResetRedirectUrl formats portal parameters correctly', () => {
  const studentUrl = new URL(getPasswordResetRedirectUrl('student'));
  assert.equal(studentUrl.searchParams.get('page'), 'updatePassword');
  assert.equal(studentUrl.searchParams.get('portal'), 'student');

  const teacherUrl = new URL(getPasswordResetRedirectUrl('teacher'));
  assert.equal(teacherUrl.searchParams.get('page'), 'updatePassword');
  assert.equal(teacherUrl.searchParams.get('portal'), 'teacher');
});
