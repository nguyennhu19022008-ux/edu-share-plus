import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const anonKey = process.env.SUPABASE_ANON_KEY;
const dbUrl = process.env.SUPABASE_DB_URL;
const mailpitUrl = 'http://127.0.0.1:54324';

assert.ok(anonKey, 'SUPABASE_ANON_KEY is required');
assert.ok(dbUrl, 'SUPABASE_DB_URL is required');

const anon = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

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

async function jsonRequest(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { response, body };
}

async function waitFor(predicate, { timeoutMs = 15_000, intervalMs = 250 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastValue;
  while (Date.now() < deadline) {
    lastValue = await predicate();
    if (lastValue) return lastValue;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Timed out waiting for condition. Last value: ${JSON.stringify(lastValue)}`);
}

async function findConfirmationUrl(email) {
  return waitFor(async () => {
    const { response, body } = await jsonRequest(`${mailpitUrl}/api/v1/messages`);
    if (!response.ok || !Array.isArray(body?.messages)) return null;

    const summary = body.messages.find((message) =>
      Array.isArray(message.To) && message.To.some((to) => to.Address === email),
    );
    if (!summary) return null;

    const detail = await jsonRequest(`${mailpitUrl}/api/v1/message/${summary.ID}`);
    if (!detail.response.ok) return null;

    const source = `${detail.body?.HTML || ''}\n${detail.body?.Text || ''}`.replaceAll('&amp;', '&');
    const match = source.match(/https?:\/\/[^"'<>\s]+\/auth\/v1\/verify\?[^"'<>\s]+/);
    return match?.[0] || null;
  });
}

async function confirmEmail(email) {
  const confirmationUrl = await findConfirmationUrl(email);
  const response = await fetch(confirmationUrl, { redirect: 'manual' });
  assert.ok(
    [200, 302, 303, 307, 308].includes(response.status),
    `unexpected confirmation response ${response.status} for ${email}`,
  );
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
const password = 'EduShare5B!StrongPass';

// Auth is shared infrastructure: an identity without the explicit student intent
// must not be silently assigned an EDU SHARE+ student profile or role.
const nonStudentEmail = `phase5b-non-student-${unique}@example.test`;
const nonStudent = await anon.auth.signUp({ email: nonStudentEmail, password });
assert.equal(nonStudent.error, null, `non-student signup failed: ${nonStudent.error?.message ?? ''}`);
assert.ok(nonStudent.data.user?.id, 'non-student signup should create an Auth user');
assert.equal(
  sqlValue(`select count(*)::text from public.profiles where user_id='${nonStudent.data.user.id}'::uuid;`),
  '0',
  'non-student Auth identity must not receive a student profile',
);

async function signUpStudent({ suffix, enteredName, className = '12 A1', phone }) {
  const email = `phase5b-${suffix}-${unique}@example.test`;
  const result = await anon.auth.signUp({
    email,
    password,
    options: {
      data: {
        registration_intent: 'student_v2',
        full_name: enteredName,
        school_id: schoolId,
        class_name: className,
        phone,
      },
      emailRedirectTo: 'http://localhost:5173/?page=loginStudent&confirmed=1',
    },
  });

  assert.equal(result.error, null, `${suffix} signup failed: ${result.error?.message ?? ''}`);
  assert.ok(result.data.user?.id, `${suffix} signup should create an Auth user`);
  assert.equal(result.data.session, null, `${suffix} must not get a session before confirmation`);
  return { email, userId: result.data.user.id };
}

const matched = await signUpStudent({
  suffix: 'matched',
  enteredName: 'Tên học sinh tự nhập',
  phone: '+84 900 000 001',
});

assert.equal(
  sqlValue(`
    select concat_ws('|', school_id::text, class_normalized, phone_normalized)
    from private.student_registration_claims
    where user_id='${matched.userId}'::uuid;
  `),
  `${schoolId}|12a1|0900000001`,
  'student registration must snapshot normalized private claims',
);
assert.equal(
  sqlValue(`
    select concat_ws('|', account_status, school_membership_status)
    from public.profiles where user_id='${matched.userId}'::uuid;
  `),
  'pending_review|needs_revalidation',
);

const academicYear = '2026-2027';
sqlExec(`
  insert into public.school_classes (school_id, label, grade_level, academic_year, is_active)
  values ('${schoolId}'::uuid, '12A1', 12, '${academicYear}', true)
  on conflict (school_id, label, academic_year)
  do update set is_active=true, updated_at=now();
`);
const classId = sqlValue(`
  select id::text
  from public.school_classes
  where school_id='${schoolId}'::uuid
    and label='12A1'
    and academic_year='${academicYear}'
  limit 1;
`);
assert.ok(classId, 'expected test class id');

const batchId = sqlValue('select gen_random_uuid()::text;');
sqlExec(`
  insert into private.roster_import_batches (
    id, school_id, academic_year, source_filename, status,
    total_rows, valid_rows, invalid_rows, imported_by, activated_at
  ) values (
    '${batchId}'::uuid, '${schoolId}'::uuid, '${academicYear}', 'phase5b-test.csv', 'active',
    1, 1, 0, '${matched.userId}'::uuid, now()
  );

  insert into private.student_roster (
    batch_id, school_id, class_id, academic_year,
    full_name, class_name, class_normalized, phone_normalized
  ) values (
    '${batchId}'::uuid, '${schoolId}'::uuid, '${classId}'::uuid, '${academicYear}',
    'Nguyễn Văn Chính Thức', '12A1', '12a1', '0900000001'
  );
`);

// Unique + unclaimed roster match: canonical school identity wins and the account
// becomes usable only after email confirmation.
await confirmEmail(matched.email);
await waitFor(async () => {
  const state = sqlValue(`
    select concat_ws('|', account_status, school_membership_status, coalesce(membership_verification_method, ''))
    from public.profiles where user_id='${matched.userId}'::uuid;
  `);
  return state === 'approved|verified|school_roster_match' ? state : null;
});

assert.equal(
  sqlValue(`
    select concat_ws('|', full_name, class_id::text)
    from public.profiles where user_id='${matched.userId}'::uuid;
  `),
  `Nguyễn Văn Chính Thức|${classId}`,
  'auto-match must replace entered identity with canonical roster identity',
);
assert.equal(
  sqlValue(`
    select count(*)::text
    from private.student_roster_claims
    where user_id='${matched.userId}'::uuid
      and released_at is null
      and verification_method='school_roster_match';
  `),
  '1',
  'auto-match must create exactly one active roster claim',
);
assert.equal(
  sqlValue(`
    select status
    from public.account_reviews
    where user_id='${matched.userId}'::uuid
    order by submitted_at desc
    limit 1;
  `),
  'approved',
  'auto-match must create approved review history',
);

async function expectManualReview({ suffix, phone, expectedReason }) {
  const student = await signUpStudent({
    suffix,
    enteredName: `Manual ${suffix}`,
    phone,
  });
  await confirmEmail(student.email);

  await waitFor(async () => {
    const reason = sqlValue(`
      select coalesce(submission_snapshot->>'roster_match_reason', '')
      from public.account_reviews
      where user_id='${student.userId}'::uuid
        and status in ('pending', 'needs_information')
      order by submitted_at desc
      limit 1;
    `);
    return reason === expectedReason ? reason : null;
  });

  assert.equal(
    sqlValue(`
      select concat_ws('|', account_status, school_membership_status, coalesce(membership_verification_method, ''))
      from public.profiles where user_id='${student.userId}'::uuid;
    `),
    'pending_review|needs_revalidation|',
    `${suffix} must remain pending and unverified`,
  );

  return student;
}

await expectManualReview({
  suffix: 'not-found',
  phone: '0900000002',
  expectedReason: 'roster_not_found',
});

// Two same-school/class/phone candidates are intentionally ambiguous; do not guess by name.
sqlExec(`
  insert into private.student_roster (
    batch_id, school_id, class_id, academic_year,
    full_name, class_name, class_normalized, phone_normalized
  ) values
    ('${batchId}'::uuid, '${schoolId}'::uuid, '${classId}'::uuid, '${academicYear}',
      'Học sinh trùng A', '12A1', '12a1', '0900000003'),
    ('${batchId}'::uuid, '${schoolId}'::uuid, '${classId}'::uuid, '${academicYear}',
      'Học sinh trùng B', '12A1', '12a1', '0900000003');
`);

await expectManualReview({
  suffix: 'ambiguous',
  phone: '0900000003',
  expectedReason: 'roster_ambiguous',
});

// The first matched row is already claimed by `matched`; a second account using the
// same school/class/phone must never steal it.
await expectManualReview({
  suffix: 'already-claimed',
  phone: '0900000001',
  expectedReason: 'roster_already_claimed',
});

assert.equal(
  sqlValue(`
    select count(*)::text
    from private.student_roster_claims
    where roster_entry_id = (
      select id from private.student_roster
      where batch_id='${batchId}'::uuid and phone_normalized='0900000001'
      limit 1
    ) and released_at is null;
  `),
  '1',
  'a claimed roster row must still have exactly one active account claim',
);

console.log('Phase 5B roster verification outcomes PASS');
