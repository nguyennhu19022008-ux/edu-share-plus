import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.SUPABASE_DB_URL;

assert.ok(anonKey, 'SUPABASE_ANON_KEY is required');
assert.ok(serviceRoleKey, 'SUPABASE_SERVICE_ROLE_KEY is required');
assert.ok(dbUrl, 'SUPABASE_DB_URL is required');

const anon = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

function sqlValue(query) {
  return execFileSync(
    'psql',
    [dbUrl, '-At', '-v', 'ON_ERROR_STOP=1', '-c', query],
    { encoding: 'utf8' },
  ).trim();
}

const schoolId = sqlValue(
  "select id::text from public.schools where code='THPT_NGUYEN_DU' limit 1;",
);
assert.ok(schoolId, 'expected THPT_NGUYEN_DU seed school');

const membershipColumns = sqlValue(`
  select count(*)::text
  from information_schema.columns
  where table_schema='public'
    and table_name='profiles'
    and column_name in (
      'school_membership_status',
      'membership_verification_method',
      'membership_verified_at'
    );
`);
assert.equal(membershipColumns, '3', 'Phase 5B membership columns must exist');

const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const nonStudentEmail = `phase5b-non-student-${unique}@example.test`;
const studentEmail = `phase5b-student-${unique}@example.test`;
const password = 'EduShare5B!StrongPass';

const nonStudent = await anon.auth.signUp({
  email: nonStudentEmail,
  password,
});
assert.equal(
  nonStudent.error,
  null,
  `non-student Auth identity should be allowed without EDU SHARE+ provisioning: ${nonStudent.error?.message ?? ''}`,
);
assert.ok(nonStudent.data.user?.id, 'non-student signup should create an Auth user');

const nonStudentProfileCount = sqlValue(`
  select count(*)::text
  from public.profiles
  where user_id='${nonStudent.data.user.id}'::uuid;
`);
assert.equal(nonStudentProfileCount, '0', 'non-student Auth identity must not receive a student profile');

const student = await anon.auth.signUp({
  email: studentEmail,
  password,
  options: {
    data: {
      registration_intent: 'student_v2',
      full_name: 'Tên nhập từ học sinh',
      school_id: schoolId,
      class_name: '12 A1',
      phone: '+84 900 000 001',
    },
    emailRedirectTo: 'http://localhost:5173/?page=loginStudent&confirmed=1',
  },
});
assert.equal(student.error, null, `student signup failed: ${student.error?.message ?? ''}`);
assert.ok(student.data.user?.id, 'student signup should create an Auth user');
assert.equal(student.data.session, null, 'student must not receive a session before email confirmation');

const claimRow = sqlValue(`
  select concat_ws('|', school_id::text, class_normalized, phone_normalized)
  from private.student_registration_claims
  where user_id='${student.data.user.id}'::uuid;
`);
assert.equal(
  claimRow,
  `${schoolId}|12a1|0900000001`,
  'student registration must snapshot normalized private claims',
);

const profileState = sqlValue(`
  select concat_ws('|', account_status, school_membership_status)
  from public.profiles
  where user_id='${student.data.user.id}'::uuid;
`);
assert.equal(profileState, 'pending_review|needs_revalidation');

await admin.auth.admin.deleteUser(nonStudent.data.user.id);
await admin.auth.admin.deleteUser(student.data.user.id);

console.log('Phase 5B registration trust foundation PASS');
