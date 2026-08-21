import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const anonKey = process.env.SUPABASE_ANON_KEY;
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

assert.ok(anonKey, 'SUPABASE_ANON_KEY is required');
assert.ok(secretKey, 'SUPABASE_SERVICE_ROLE_KEY is required');

const anonymous = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const adminClient = createClient(supabaseUrl, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

async function makeUser({ email, fullName, schoolId, roleCode }) {
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password: 'EduShare5B!RosterAdmin',
    email_confirm: true,
  });
  assert.equal(error, null, `create user ${email}: ${error?.message ?? ''}`);
  const userId = data.user.id;

  const { error: profileError } = await adminClient.from('profiles').insert({
    user_id: userId,
    school_id: schoolId,
    full_name: fullName,
    account_status: 'approved',
    school_membership_status: roleCode === 'student' ? 'verified' : 'needs_revalidation',
    membership_verification_method: roleCode === 'student' ? 'teacher_manual_review' : null,
    membership_verified_at: roleCode === 'student' ? new Date().toISOString() : null,
  });
  assert.equal(profileError, null, `profile ${email}: ${profileError?.message ?? ''}`);

  const { data: role, error: roleError } = await adminClient
    .from('roles')
    .select('id')
    .eq('code', roleCode)
    .single();
  assert.equal(roleError, null, `role ${roleCode}: ${roleError?.message ?? ''}`);

  const { error: grantError } = await adminClient.from('user_roles').insert({
    user_id: userId,
    role_id: role.id,
    school_id: roleCode === 'admin' ? null : schoolId,
  });
  assert.equal(grantError, null, `grant ${roleCode}: ${grantError?.message ?? ''}`);

  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const signIn = await client.auth.signInWithPassword({
    email,
    password: 'EduShare5B!RosterAdmin',
  });
  assert.equal(signIn.error, null, `signin ${email}: ${signIn.error?.message ?? ''}`);
  return { userId, client };
}

const { data: schools, error: schoolError } = await adminClient
  .from('schools')
  .select('id,code')
  .order('code');
assert.equal(schoolError, null);
assert.ok(schools.length >= 1, 'expected at least one school');
const schoolA = schools[0];

let schoolB = schools.find((school) => school.id !== schoolA.id);
if (!schoolB) {
  const { data, error } = await adminClient
    .from('schools')
    .insert({ code: `PHASE5B_${Date.now()}`, name: 'Phase 5B Test School' })
    .select('id,code')
    .single();
  assert.equal(error, null);
  schoolB = data;
}

const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const teacherA = await makeUser({
  email: `teacher-a-${nonce}@example.test`,
  fullName: 'Teacher A',
  schoolId: schoolA.id,
  roleCode: 'teacher_moderator',
});
const teacherB = await makeUser({
  email: `teacher-b-${nonce}@example.test`,
  fullName: 'Teacher B',
  schoolId: schoolB.id,
  roleCode: 'teacher_moderator',
});
const studentA = await makeUser({
  email: `student-a-${nonce}@example.test`,
  fullName: 'Student A',
  schoolId: schoolA.id,
  roleCode: 'student',
});

const rows = [
  { full_name: 'Nguyễn Văn A', class_name: '12 A1', phone: '+84 900 100 001' },
  { full_name: 'Trần Thị B', class_name: '11A2', phone: '0900100002' },
];

const sameSchool = await teacherA.client.rpc('import_student_roster', {
  p_school_id: schoolA.id,
  p_academic_year: '2026-2027',
  p_source_filename: 'phase5b.csv',
  p_rows: rows,
});
assert.equal(sameSchool.error, null, `same-school import should succeed: ${sameSchool.error?.message ?? ''}`);
assert.equal(sameSchool.data?.status, 'previewed');
assert.equal(sameSchool.data?.valid_rows, 2);
assert.equal(sameSchool.data?.invalid_rows, 0);
assert.ok(sameSchool.data?.batch_id, 'import should return batch_id');
const batchId = sameSchool.data.batch_id;

const crossSchool = await teacherB.client.rpc('import_student_roster', {
  p_school_id: schoolA.id,
  p_academic_year: '2026-2027',
  p_source_filename: 'forbidden.csv',
  p_rows: rows,
});
assert.ok(crossSchool.error, 'cross-school teacher import must be denied');

const studentAttempt = await studentA.client.rpc('list_student_roster_batches', {
  p_school_id: schoolA.id,
});
assert.ok(studentAttempt.error, 'student roster listing must be denied');

const anonymousAttempt = await anonymous.rpc('list_student_roster_batches', {
  p_school_id: schoolA.id,
});
assert.ok(anonymousAttempt.error, 'anonymous roster listing must be denied');

const invalid = await teacherA.client.rpc('import_student_roster', {
  p_school_id: schoolA.id,
  p_academic_year: '2026-2027',
  p_source_filename: 'invalid.csv',
  p_rows: [{ full_name: '', class_name: '12A1', phone: 'abc' }],
});
assert.ok(invalid.error, 'invalid roster import must fail atomically');

const batches = await teacherA.client.rpc('list_student_roster_batches', {
  p_school_id: schoolA.id,
});
assert.equal(batches.error, null, `batch list should succeed: ${batches.error?.message ?? ''}`);
assert.ok(Array.isArray(batches.data));
assert.equal(
  batches.data.filter((batch) => batch.source_filename === 'invalid.csv').length,
  0,
  'failed import must not leave a batch behind',
);

const activate = await teacherA.client.rpc('activate_student_roster_batch', {
  p_batch_id: batchId,
});
assert.equal(activate.error, null, `activation should succeed: ${activate.error?.message ?? ''}`);
assert.equal(activate.data?.status, 'active');

const activeRows = await teacherA.client.rpc('list_active_student_roster', {
  p_school_id: schoolA.id,
});
assert.equal(activeRows.error, null, `active roster list should succeed: ${activeRows.error?.message ?? ''}`);
assert.equal(activeRows.data.length, 2);
assert.deepEqual(
  activeRows.data.map((row) => row.phone_normalized).sort(),
  ['0900100001', '0900100002'],
);

const secondImport = await teacherA.client.rpc('import_student_roster', {
  p_school_id: schoolA.id,
  p_academic_year: '2026-2027',
  p_source_filename: 'phase5b-second.csv',
  p_rows: [{ full_name: 'Lê Văn C', class_name: '10A3', phone: '0900100003' }],
});
assert.equal(secondImport.error, null);

const secondActivate = await teacherA.client.rpc('activate_student_roster_batch', {
  p_batch_id: secondImport.data.batch_id,
});
assert.equal(secondActivate.error, null);

const finalBatches = await teacherA.client.rpc('list_student_roster_batches', {
  p_school_id: schoolA.id,
});
assert.equal(finalBatches.error, null);
assert.equal(finalBatches.data.filter((batch) => batch.status === 'active').length, 1);
assert.equal(
  finalBatches.data.find((batch) => batch.id === batchId)?.status,
  'archived',
  'activation must archive the previous active batch',
);

console.log('Phase 5B roster management RPC E2E PASS');
