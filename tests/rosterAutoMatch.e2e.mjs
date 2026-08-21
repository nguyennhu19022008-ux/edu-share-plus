import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const anonKey = process.env.SUPABASE_ANON_KEY;
const dbUrl = process.env.SUPABASE_DB_URL;
const mailpitUrl = 'http://127.0.0.1:54324';

assert.ok(anonKey, 'SUPABASE_ANON_KEY is required');
assert.ok(dbUrl, 'SUPABASE_DB_URL is required');

const supabase = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

function sqlValue(query) {
  return execFileSync('psql', [dbUrl, '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', query], {
    encoding: 'utf8',
  }).trim();
}

async function jsonRequest(url) {
  const response = await fetch(url);
  const text = await response.text();
  return { response, body: text ? JSON.parse(text) : null };
}

async function waitFor(predicate, { timeoutMs = 15_000, intervalMs = 250 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('Timed out waiting for condition');
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
    return source.match(/https?:\/\/[^"'<>\s]+\/auth\/v1\/verify\?[^"'<>\s]+/)?.[0] || null;
  });
}

const schoolId = sqlValue("select id::text from public.schools where code='THPT_NGUYEN_DU' limit 1;");
assert.ok(schoolId, 'expected THPT_NGUYEN_DU seed school');

const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const email = `phase5b-auto-${unique}@example.test`;
const password = 'EduShare5B!StrongPass';
const enteredName = 'Tên học sinh tự nhập';
const canonicalName = 'Nguyễn Văn Roster';
const className = '12 A1';
const phone = '0900000011';

const signup = await supabase.auth.signUp({
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
assert.equal(signup.error, null, `signup failed: ${signup.error?.message ?? ''}`);
assert.ok(signup.data.user?.id, 'student signup should create an Auth user');
const userId = signup.data.user.id;

const classId = sqlValue(`
  insert into public.school_classes (school_id, label, grade_level, academic_year, is_active)
  values ('${schoolId}'::uuid, '12A1', 12, '2026-2027', true)
  on conflict (school_id, label, academic_year)
  do update set is_active = true
  returning id::text;
`);
assert.ok(classId, 'expected class id');

const batchId = sqlValue(`
  insert into private.roster_import_batches (
    school_id, academic_year, source_filename, status,
    total_rows, valid_rows, invalid_rows, imported_by, activated_at
  )
  values (
    '${schoolId}'::uuid, '2026-2027', 'phase5b-auto.csv', 'active',
    1, 1, 0, '${userId}'::uuid, now()
  )
  returning id::text;
`);
assert.ok(batchId, 'expected active roster batch');

const rosterId = sqlValue(`
  insert into private.student_roster (
    batch_id, school_id, class_id, academic_year,
    full_name, class_name, class_normalized, phone_normalized
  )
  values (
    '${batchId}'::uuid, '${schoolId}'::uuid, '${classId}'::uuid, '2026-2027',
    '${canonicalName}', '12A1', '12a1', '${phone}'
  )
  returning id::text;
`);
assert.ok(rosterId, 'expected roster row');

const confirmationUrl = await findConfirmationUrl(email);
const confirmation = await fetch(confirmationUrl, { redirect: 'manual' });
assert.ok([200, 302, 303, 307, 308].includes(confirmation.status));

const state = await waitFor(async () => {
  const value = sqlValue(`
    select concat_ws('|', account_status, school_membership_status,
      coalesce(membership_verification_method, ''), full_name,
      coalesce(class_id::text, ''))
    from public.profiles
    where user_id='${userId}'::uuid;
  `);
  return value.startsWith('approved|verified|school_roster_match|') ? value : null;
});
assert.equal(state, `approved|verified|school_roster_match|${canonicalName}|${classId}`);

const activeClaim = sqlValue(`
  select count(*)::text
  from private.student_roster_claims
  where user_id='${userId}'::uuid
    and roster_entry_id='${rosterId}'::uuid
    and released_at is null;
`);
assert.equal(activeClaim, '1', 'unique roster match must create one active claim');

const approvedHistory = sqlValue(`
  select count(*)::text
  from public.account_reviews
  where user_id='${userId}'::uuid
    and status='approved';
`);
assert.equal(approvedHistory, '1', 'auto-match should leave an approved review history row');

console.log('Phase 5B auto-match E2E PASS');
