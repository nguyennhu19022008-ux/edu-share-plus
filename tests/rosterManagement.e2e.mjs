import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const anonKey = process.env.SUPABASE_ANON_KEY;
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.SUPABASE_DB_URL;

assert.ok(anonKey, 'SUPABASE_ANON_KEY is required');
assert.ok(secretKey, 'SUPABASE_SERVICE_ROLE_KEY is required');
assert.ok(dbUrl, 'SUPABASE_DB_URL is required');

const anonymous = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const authAdmin = createClient(supabaseUrl, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'null';
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlValue(query) {
  return execFileSync(
    'psql',
    [dbUrl, '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', query],
    { encoding: 'utf8' },
  ).trim();
}

function sqlExec(query) {
  execFileSync(
    'psql',
    [dbUrl, '-q', '-v', 'ON_ERROR_STOP=1', '-c', query],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
}

async function makeUser({ email, fullName, schoolId, roleCode }) {
  const { data, error } = await authAdmin.auth.admin.createUser({
    email,
    password: 'EduShare5B!RosterAdmin',
    email_confirm: true,
  });
  assert.equal(error, null, `create user ${email}: ${error?.message ?? ''}`);
  const userId = data.user.id;

  const isStudent = roleCode === 'student';
  sqlExec(`
    insert into public.profiles (
      user_id,
      school_id,
      full_name,
      account_status,
      school_membership_status,
      membership_verification_method,
      membership_verified_at
    ) values (
      '${userId}'::uuid,
      '${schoolId}'::uuid,
      ${sqlLiteral(fullName)},
      'approved',
      ${sqlLiteral(isStudent ? 'verified' : 'needs_revalidation')},
      ${sqlLiteral(isStudent ? 'teacher_manual_review' : null)},
      ${isStudent ? 'now()' : 'null'}
    );

    insert into public.user_roles (user_id, role_id, school_id)
    select
      '${userId}'::uuid,
      r.id,
      ${roleCode === 'admin' ? 'null' : `'${schoolId}'::uuid`}
    from public.roles r
    where r.code = ${sqlLiteral(roleCode)};
  `);

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

const schoolAId = sqlValue(
  "select id::text from public.schools where code='THPT_NGUYEN_DU' limit 1;",
);
assert.ok(schoolAId, 'expected THPT_NGUYEN_DU seed school');
const schoolA = { id: schoolAId, code: 'THPT_NGUYEN_DU' };

let schoolBId = sqlValue(`
  select id::text
  from public.schools
  where id <> '${schoolA.id}'::uuid
  order by code
  limit 1;
`);
if (!schoolBId) {
  schoolBId = sqlValue(`
    insert into public.schools (code, name)
    values ('PHASE5B_TEST', 'Phase 5B Test School')
    on conflict (code) do update set name=excluded.name
    returning id::text;
  `);
}
const schoolB = { id: schoolBId };

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
