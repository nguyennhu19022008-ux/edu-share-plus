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

async function makeUser({
  email,
  fullName,
  schoolId,
  roleCode,
  accountStatus = 'approved',
  membershipStatus = 'needs_revalidation',
}) {
  const password = 'EduShare5B!MembershipReview';
  const { data, error } = await authAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.equal(error, null, `create user ${email}: ${error?.message ?? ''}`);
  const userId = data.user.id;

  sqlExec(`
    insert into public.profiles (
      user_id,
      school_id,
      full_name,
      account_status,
      school_membership_status
    ) values (
      '${userId}'::uuid,
      '${schoolId}'::uuid,
      ${sqlLiteral(fullName)},
      ${sqlLiteral(accountStatus)},
      ${sqlLiteral(membershipStatus)}
    );

    insert into public.user_roles (user_id, role_id, school_id)
    select '${userId}'::uuid, r.id, '${schoolId}'::uuid
    from public.roles r
    where r.code = ${sqlLiteral(roleCode)};
  `);

  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const signIn = await client.auth.signInWithPassword({ email, password });
  assert.equal(signIn.error, null, `signin ${email}: ${signIn.error?.message ?? ''}`);
  return { userId, client };
}

function createOpenReview(userId, rosterMatchReason) {
  sqlExec(`
    insert into public.account_reviews (
      user_id,
      status,
      submission_snapshot
    ) values (
      '${userId}'::uuid,
      'pending',
      jsonb_build_object('roster_match_reason', ${sqlLiteral(rosterMatchReason)})
    );
  `);
}

const schoolId = sqlValue(
  "select id::text from public.schools where code='THPT_NGUYEN_DU' limit 1;",
);
assert.ok(schoolId, 'expected THPT_NGUYEN_DU seed school');

const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const teacher = await makeUser({
  email: `membership-teacher-${nonce}@example.test`,
  fullName: 'Membership Teacher',
  schoolId,
  roleCode: 'teacher_moderator',
});

const pendingStudent = await makeUser({
  email: `membership-pending-${nonce}@example.test`,
  fullName: 'Pending Student',
  schoolId,
  roleCode: 'student',
  accountStatus: 'pending_review',
  membershipStatus: 'needs_revalidation',
});
createOpenReview(pendingStudent.userId, 'roster_not_found');

// Student context is an authorization boundary, not merely a profile read.
const pendingContext = await pendingStudent.client.rpc('get_current_student_context');
assert.ok(
  pendingContext.error,
  'pending_review student must not receive protected student context',
);

const queueBeforeDecision = await teacher.client.rpc('list_account_review_queue');
assert.equal(
  queueBeforeDecision.error,
  null,
  `teacher review queue should load: ${queueBeforeDecision.error?.message ?? ''}`,
);
const queuedStudent = queueBeforeDecision.data.find(
  (row) => row.user_id === pendingStudent.userId,
);
assert.ok(queuedStudent, 'manual-review student must appear in same-school queue');
assert.equal(
  queuedStudent.roster_match_reason,
  'roster_not_found',
  'staff queue must expose the private workflow reason without exposing roster data to the student',
);

const approval = await teacher.client.rpc('review_student_account', {
  p_user_id: pendingStudent.userId,
  p_decision: 'approved',
  p_reason: 'Đã đối chiếu thủ công với hồ sơ nhà trường.',
});
assert.equal(approval.error, null, `manual approval should succeed: ${approval.error?.message ?? ''}`);
assert.equal(approval.data?.account_status, 'approved');
assert.equal(approval.data?.school_membership_status, 'verified');
assert.equal(approval.data?.membership_verification_method, 'teacher_manual_review');

assert.equal(
  sqlValue(`
    select concat_ws('|',
      account_status,
      school_membership_status,
      coalesce(membership_verification_method, ''),
      (membership_verified_at is not null)::text
    )
    from public.profiles
    where user_id='${pendingStudent.userId}'::uuid;
  `),
  'approved|verified|teacher_manual_review|true',
  'manual approval must verify school membership atomically',
);

const approvedContext = await pendingStudent.client.rpc('get_current_student_context');
assert.equal(
  approvedContext.error,
  null,
  `verified approved student should receive context: ${approvedContext.error?.message ?? ''}`,
);
assert.equal(approvedContext.data?.account_status, 'approved');
assert.equal(approvedContext.data?.school_membership_status, 'verified');
assert.equal(approvedContext.data?.membership_verification_method, 'teacher_manual_review');
assert.ok(approvedContext.data?.membership_verified_at);

assert.equal(
  sqlValue(`
    select concat_ws('|',
      coalesce(before_state->>'school_membership_status', ''),
      coalesce(after_state->>'school_membership_status', ''),
      coalesce(after_state->>'membership_verification_method', '')
    )
    from private.audit_logs
    where action='student_account_review_decision'
      and metadata->>'target_user_id'='${pendingStudent.userId}'
    order by id desc
    limit 1;
  `),
  'needs_revalidation|verified|teacher_manual_review',
  'manual approval audit must include membership transition',
);

const approvedButUnverified = await makeUser({
  email: `membership-unverified-${nonce}@example.test`,
  fullName: 'Approved But Unverified',
  schoolId,
  roleCode: 'student',
  accountStatus: 'approved',
  membershipStatus: 'needs_revalidation',
});
const unverifiedContext = await approvedButUnverified.client.rpc('get_current_student_context');
assert.ok(
  unverifiedContext.error,
  'approved account without verified school membership must remain outside protected student access',
);

const needsInfoStudent = await makeUser({
  email: `membership-needs-info-${nonce}@example.test`,
  fullName: 'Needs Information Student',
  schoolId,
  roleCode: 'student',
  accountStatus: 'pending_review',
  membershipStatus: 'needs_revalidation',
});
createOpenReview(needsInfoStudent.userId, 'roster_not_found');
const needsInfoDecision = await teacher.client.rpc('review_student_account', {
  p_user_id: needsInfoStudent.userId,
  p_decision: 'needs_information',
  p_reason: 'Cần bổ sung giấy tờ đối chiếu.',
});
assert.equal(needsInfoDecision.error, null);
assert.equal(
  sqlValue(`
    select concat_ws('|', account_status, school_membership_status,
      coalesce(membership_verification_method, ''))
    from public.profiles
    where user_id='${needsInfoStudent.userId}'::uuid;
  `),
  'pending_review|needs_revalidation|',
  'needs_information must not verify membership',
);

const rejectedStudent = await makeUser({
  email: `membership-rejected-${nonce}@example.test`,
  fullName: 'Rejected Student',
  schoolId,
  roleCode: 'student',
  accountStatus: 'pending_review',
  membershipStatus: 'needs_revalidation',
});
createOpenReview(rejectedStudent.userId, 'roster_not_found');
const rejectedDecision = await teacher.client.rpc('review_student_account', {
  p_user_id: rejectedStudent.userId,
  p_decision: 'rejected',
  p_reason: 'Thông tin không thể xác minh.',
});
assert.equal(rejectedDecision.error, null);
assert.equal(
  sqlValue(`
    select concat_ws('|', account_status, school_membership_status,
      coalesce(membership_verification_method, ''))
    from public.profiles
    where user_id='${rejectedStudent.userId}'::uuid;
  `),
  'rejected|needs_revalidation|',
  'rejection must not verify membership',
);

console.log('Phase 5B membership-aware manual review E2E PASS');
