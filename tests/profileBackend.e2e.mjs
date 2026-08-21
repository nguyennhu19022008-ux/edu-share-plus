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
  auth: { persistSession:false, autoRefreshToken:false, detectSessionInUrl:false },
});
const authAdmin = createClient(supabaseUrl, secretKey, {
  auth: { persistSession:false, autoRefreshToken:false, detectSessionInUrl:false },
});

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'null';
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlValue(query) {
  return execFileSync(
    'psql',
    [dbUrl, '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', query],
    { encoding:'utf8' },
  ).trim();
}

function sqlExec(query) {
  execFileSync(
    'psql',
    [dbUrl, '-q', '-v', 'ON_ERROR_STOP=1', '-c', query],
    { encoding:'utf8', stdio:['ignore','pipe','pipe'] },
  );
}

function assertAnonymousCannotRead(result, label) {
  if (result.error) {
    assert.equal(result.error.code, '42501', `${label} denial must be a privilege error when SELECT is not granted`);
    return;
  }
  assert.equal(result.data?.length ?? 0, 0, `${label} must expose zero rows when SELECT is RLS-filtered`);
}

const privacyRpcCount = sqlValue(`
  select count(*)::text
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname='public'
    and p.proname='update_my_profile_privacy'
    and pg_get_function_identity_arguments(p.oid) =
      'p_show_name boolean, p_show_class boolean, p_show_email boolean, p_show_phone boolean';
`);
assert.equal(privacyRpcCount, '1', 'Phase 5D trusted profile privacy RPC must exist');

const rpcSecurity = sqlValue(`
  select (
    p.prosecdef
    and coalesce(array_to_string(p.proconfig, ','), '') like '%search_path=%'
  )::int::text
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='update_my_profile_privacy'
    and pg_get_function_identity_arguments(p.oid) =
      'p_show_name boolean, p_show_class boolean, p_show_email boolean, p_show_phone boolean';
`);
assert.equal(rpcSecurity, '1', 'privacy RPC must be SECURITY DEFINER with fixed search_path');

const anonExec = sqlValue(`
  select has_function_privilege(
    'anon',
    'public.update_my_profile_privacy(boolean,boolean,boolean,boolean)',
    'EXECUTE'
  )::int::text;
`);
const authenticatedExec = sqlValue(`
  select has_function_privilege(
    'authenticated',
    'public.update_my_profile_privacy(boolean,boolean,boolean,boolean)',
    'EXECUTE'
  )::int::text;
`);
assert.equal(anonExec, '0', 'anon must not execute profile privacy RPC');
assert.equal(authenticatedExec, '1', 'authenticated must execute profile privacy RPC');

for (const table of ['profiles', 'profile_private']) {
  const directUpdate = sqlValue(`select has_table_privilege('authenticated', 'public.${table}', 'UPDATE')::int::text;`);
  assert.equal(directUpdate, '0', `authenticated must not have direct UPDATE on public.${table}`);
}

const broadUpdatePolicies = sqlValue(`
  select count(*)::text
  from pg_policies
  where schemaname='public'
    and tablename in ('profiles','profile_private')
    and cmd='UPDATE'
    and 'authenticated'=any(roles);
`);
assert.equal(broadUpdatePolicies, '0', 'direct self UPDATE policies must be removed in favor of the narrow RPC');

const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const password = 'EduShare5D!Profile1';

const schoolA = sqlValue("select id::text from public.schools where code='THPT_NGUYEN_DU' limit 1;");
assert.ok(schoolA, 'expected THPT_NGUYEN_DU seed school');
const schoolB = sqlValue(`
  insert into public.schools (code, name, is_active, registration_enabled, roster_verification_enabled, marketplace_scope)
  values ('P5D_${nonce.replaceAll('-', '').slice(0,14)}', 'Phase 5D School B', true, true, true, 'school')
  returning id::text;
`);

function ensureClass(schoolId, label) {
  return sqlValue(`
    insert into public.school_classes (school_id, label, grade_level, academic_year, is_active)
    values ('${schoolId}'::uuid, ${sqlLiteral(label)}, 11, '2026-2027', true)
    on conflict (school_id, label, academic_year)
    do update set is_active=true, updated_at=now()
    returning id::text;
  `);
}

const classA = ensureClass(schoolA, '11A05D');
const classB = ensureClass(schoolB, '11B05D');

async function createIdentity({ suffix, schoolId, classId, roleCode, phone }) {
  const email = `phase5d-${suffix}-${nonce}@example.test`;
  const { data, error } = await authAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm:true,
  });
  assert.equal(error, null, `create ${suffix}: ${error?.message ?? ''}`);
  const userId = data.user.id;

  sqlExec(`
    insert into public.profiles (
      user_id, school_id, class_id, full_name, account_status,
      school_membership_status, membership_verification_method, membership_verified_at,
      show_name, show_class
    ) values (
      '${userId}'::uuid, '${schoolId}'::uuid, '${classId}'::uuid,
      ${sqlLiteral(`Profile ${suffix}`)}, 'approved', 'verified',
      'teacher_manual_review', now(), true, true
    );
    insert into public.profile_private (
      user_id, contact_email, phone, show_email, show_phone
    ) values (
      '${userId}'::uuid, ${sqlLiteral(email)}, ${sqlLiteral(phone)}, false, false
    );
    insert into public.user_roles (user_id, role_id, school_id)
    select '${userId}'::uuid, r.id, '${schoolId}'::uuid
    from public.roles r where r.code=${sqlLiteral(roleCode)};
  `);

  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession:false, autoRefreshToken:false, detectSessionInUrl:false },
  });
  const signIn = await client.auth.signInWithPassword({ email, password });
  assert.equal(signIn.error, null, `signin ${suffix}: ${signIn.error?.message ?? ''}`);

  return { userId, email, client };
}

const studentA = await createIdentity({
  suffix:'student-a', schoolId:schoolA, classId:classA,
  roleCode:'student', phone:'0905000001',
});
const studentB = await createIdentity({
  suffix:'student-b', schoolId:schoolB, classId:classB,
  roleCode:'student', phone:'0905000002',
});
const teacherA = await createIdentity({
  suffix:'teacher-a', schoolId:schoolA, classId:classA,
  roleCode:'teacher_moderator', phone:'0905000003',
});

const anonProfiles = await anonymous.from('profiles').select('user_id');
assertAnonymousCannotRead(anonProfiles, 'anonymous profiles SELECT');
const anonPrivate = await anonymous.from('profile_private').select('user_id');
assertAnonymousCannotRead(anonPrivate, 'anonymous profile_private SELECT');

const ownProfile = await studentA.client.from('profiles').select('user_id,full_name,show_name,show_class').eq('user_id', studentA.userId);
assert.equal(ownProfile.error, null);
assert.equal(ownProfile.data.length, 1, 'student must read own profile row');
const otherProfile = await studentA.client.from('profiles').select('user_id').eq('user_id', studentB.userId);
assert.equal(otherProfile.error, null);
assert.equal(otherProfile.data.length, 0, 'student must not read another student profile row');

const ownPrivate = await studentA.client.from('profile_private').select('user_id,contact_email,phone,show_email,show_phone').eq('user_id', studentA.userId);
assert.equal(ownPrivate.error, null);
assert.equal(ownPrivate.data.length, 1, 'student must read own private profile row');
const otherPrivate = await studentA.client.from('profile_private').select('user_id,phone').eq('user_id', studentB.userId);
assert.equal(otherPrivate.error, null);
assert.equal(otherPrivate.data.length, 0, 'student must not read another student private row');

const beforeB = sqlValue(`
  select concat_ws(',', p.show_name::text, p.show_class::text, pp.show_email::text, pp.show_phone::text)
  from public.profiles p join public.profile_private pp on pp.user_id=p.user_id
  where p.user_id='${studentB.userId}'::uuid;
`);

const updateA = await studentA.client.rpc('update_my_profile_privacy', {
  p_show_name:false,
  p_show_class:true,
  p_show_email:true,
  p_show_phone:true,
});
assert.equal(updateA.error, null, `student privacy update: ${updateA.error?.message ?? ''}`);
assert.deepEqual(updateA.data, {
  showName:false,
  showClass:true,
  showEmail:true,
  showPhone:true,
});

const afterA = sqlValue(`
  select concat_ws(',', p.show_name::text, p.show_class::text, pp.show_email::text, pp.show_phone::text)
  from public.profiles p join public.profile_private pp on pp.user_id=p.user_id
  where p.user_id='${studentA.userId}'::uuid;
`);
assert.equal(afterA, 'false,true,true,true', 'privacy RPC must update exactly the caller privacy flags');
const afterB = sqlValue(`
  select concat_ws(',', p.show_name::text, p.show_class::text, pp.show_email::text, pp.show_phone::text)
  from public.profiles p join public.profile_private pp on pp.user_id=p.user_id
  where p.user_id='${studentB.userId}'::uuid;
`);
assert.equal(afterB, beforeB, 'privacy RPC must not mutate another student');

const teacherUpdate = await teacherA.client.rpc('update_my_profile_privacy', {
  p_show_name:false,
  p_show_class:false,
  p_show_email:true,
  p_show_phone:true,
});
assert.ok(teacherUpdate.error, 'teacher identity must be denied by Student trust gate');

const anonymousUpdate = await anonymous.rpc('update_my_profile_privacy', {
  p_show_name:false,
  p_show_class:false,
  p_show_email:true,
  p_show_phone:true,
});
assert.ok(anonymousUpdate.error, 'anonymous caller must not execute privacy RPC');

const directProfileUpdate = await studentA.client
  .from('profiles')
  .update({ full_name:'Unauthorized change' })
  .eq('user_id', studentA.userId)
  .select('user_id');
assert.ok(directProfileUpdate.error, 'student must not directly UPDATE profiles');

const directPrivateUpdate = await studentA.client
  .from('profile_private')
  .update({ phone:'0999999999' })
  .eq('user_id', studentA.userId)
  .select('user_id');
assert.ok(directPrivateUpdate.error, 'student must not directly UPDATE profile_private');

const changedPassword = 'EduShare5D!Profile2';
const rejectedPasswordChange = await studentB.client.auth.updateUser({
  password:changedPassword,
  current_password:'DefinitelyWrong5D!',
});
assert.ok(rejectedPasswordChange.error, 'wrong current password must be rejected');

const acceptedPasswordChange = await studentB.client.auth.updateUser({
  password:changedPassword,
  current_password:password,
});
assert.equal(
  acceptedPasswordChange.error,
  null,
  `correct current password must allow password change: ${acceptedPasswordChange.error?.message ?? ''}`,
);

await studentB.client.auth.signOut({ scope:'local' });
const passwordProbe = createClient(supabaseUrl, anonKey, {
  auth: { persistSession:false, autoRefreshToken:false, detectSessionInUrl:false },
});
const oldPasswordLogin = await passwordProbe.auth.signInWithPassword({
  email:studentB.email,
  password,
});
assert.ok(oldPasswordLogin.error, 'old password must stop authenticating after a successful change');
const newPasswordLogin = await passwordProbe.auth.signInWithPassword({
  email:studentB.email,
  password:changedPassword,
});
assert.equal(newPasswordLogin.error, null, 'new password must authenticate after a successful change');

console.log('Phase 5D profile backend authorization + Auth password matrix PASS');
