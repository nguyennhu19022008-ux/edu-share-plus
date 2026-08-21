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
  auth:{ persistSession:false, autoRefreshToken:false, detectSessionInUrl:false },
});
const authAdmin = createClient(supabaseUrl, secretKey, {
  auth:{ persistSession:false, autoRefreshToken:false, detectSessionInUrl:false },
});

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'null';
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlValue(query) {
  return execFileSync('psql', [dbUrl, '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', query], { encoding:'utf8' }).trim();
}

function sqlExec(query) {
  execFileSync('psql', [dbUrl, '-q', '-v', 'ON_ERROR_STOP=1', '-c', query], {
    encoding:'utf8', stdio:['ignore','pipe','pipe'],
  });
}

const requiredColumns = [
  'preferred_contact_method',
  'original_purchase_price',
  'original_price_is_estimate',
  'purchase_date',
  'condition_grade',
  'brand',
  'model',
];
for (const column of requiredColumns) {
  const count = sqlValue(`select count(*)::text from information_schema.columns where table_schema='public' and table_name='posts' and column_name=${sqlLiteral(column)};`);
  assert.equal(count, '1', `Phase 5E posts.${column} must exist`);
}

const functionSignatures = [
  ['create_my_post', 'p_category_id uuid, p_title text, p_description text, p_trade_type text, p_sale_price bigint, p_visibility_scope text, p_preferred_contact_method text, p_original_purchase_price bigint, p_original_price_is_estimate boolean, p_purchase_date date, p_condition_grade text, p_brand text, p_model text'],
  ['update_my_post', 'p_post_id uuid, p_category_id uuid, p_title text, p_description text, p_trade_type text, p_sale_price bigint, p_visibility_scope text, p_preferred_contact_method text, p_original_purchase_price bigint, p_original_price_is_estimate boolean, p_purchase_date date, p_condition_grade text, p_brand text, p_model text'],
  ['change_my_post_lifecycle', 'p_post_id uuid, p_action text'],
];

for (const [name, args] of functionSignatures) {
  const count = sqlValue(`
    select count(*)::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname=${sqlLiteral(name)}
      and pg_get_function_identity_arguments(p.oid)=${sqlLiteral(args)};
  `);
  assert.equal(count, '1', `${name} trusted RPC must exist with the approved signature`);

  const secure = sqlValue(`
    select (p.prosecdef and coalesce(array_to_string(p.proconfig, ','),'') like '%search_path=%')::int::text
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname=${sqlLiteral(name)}
      and pg_get_function_identity_arguments(p.oid)=${sqlLiteral(args)};
  `);
  assert.equal(secure, '1', `${name} must be SECURITY DEFINER with fixed search_path`);

  const signature = `public.${name}(${args.split(', ').map((part) => part.split(' ').slice(1).join(' ')).join(',')})`;
  const anonExec = sqlValue(`select has_function_privilege('anon', ${sqlLiteral(signature)}, 'EXECUTE')::int::text;`);
  const authExec = sqlValue(`select has_function_privilege('authenticated', ${sqlLiteral(signature)}, 'EXECUTE')::int::text;`);
  assert.equal(anonExec, '0', `anon must not execute ${name}`);
  assert.equal(authExec, '1', `authenticated must execute ${name}`);
}

for (const privilege of ['INSERT','UPDATE','DELETE']) {
  const allowed = sqlValue(`select has_table_privilege('authenticated','public.posts',${sqlLiteral(privilege)})::int::text;`);
  assert.equal(allowed, '0', `authenticated must not have direct ${privilege} on public.posts`);
}

const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const password = 'EduShare5E!Owner1';
const schoolA = sqlValue("select id::text from public.schools where code='THPT_NGUYEN_DU' limit 1;");
assert.ok(schoolA, 'expected THPT_NGUYEN_DU seed school');
sqlExec(`update public.schools set marketplace_scope='school', is_active=true where id='${schoolA}'::uuid;`);

const schoolB = sqlValue(`
  insert into public.schools (code,name,is_active,registration_enabled,roster_verification_enabled,marketplace_scope)
  values (${sqlLiteral(`P5E_${nonce.replaceAll('-','').slice(0,14)}`)}, 'Phase 5E Network School', true, true, true, 'network')
  returning id::text;
`);

function ensureClass(schoolId, label) {
  return sqlValue(`
    insert into public.school_classes (school_id,label,grade_level,academic_year,is_active)
    values ('${schoolId}'::uuid,${sqlLiteral(label)},11,'2026-2027',true)
    returning id::text;
  `);
}

const classA = ensureClass(schoolA, `11A5E${nonce.slice(-3)}`);
const classB = ensureClass(schoolB, `11B5E${nonce.slice(-3)}`);
const categoryId = sqlValue("select id::text from public.categories where code='book' and is_active=true limit 1;");
assert.ok(categoryId, 'expected active book category');

async function createIdentity({ suffix, schoolId, classId, roleCode='student', accountStatus='approved', membership='verified', phone='0905000001', contactEmail=true }) {
  const email = `phase5e-${suffix}-${nonce}@example.test`;
  const { data, error } = await authAdmin.auth.admin.createUser({ email, password, email_confirm:true });
  assert.equal(error, null, `create ${suffix}: ${error?.message ?? ''}`);
  const userId = data.user.id;

  const verified = membership === 'verified';
  sqlExec(`
    insert into public.profiles (
      user_id,school_id,class_id,full_name,account_status,
      school_membership_status,membership_verification_method,membership_verified_at,
      show_name,show_class
    ) values (
      '${userId}'::uuid,'${schoolId}'::uuid,'${classId}'::uuid,${sqlLiteral(`Owner ${suffix}`)},${sqlLiteral(accountStatus)},
      ${sqlLiteral(membership)},${verified ? "'teacher_manual_review'" : 'null'},${verified ? 'now()' : 'null'},true,true
    );
    insert into public.profile_private (user_id,contact_email,phone,show_email,show_phone)
    values ('${userId}'::uuid,${contactEmail ? sqlLiteral(email) : 'null'},${phone ? sqlLiteral(phone) : 'null'},false,false);
    insert into public.user_roles (user_id,role_id,school_id)
    select '${userId}'::uuid,r.id,'${schoolId}'::uuid from public.roles r where r.code=${sqlLiteral(roleCode)};
  `);

  const client = createClient(supabaseUrl, anonKey, {
    auth:{ persistSession:false, autoRefreshToken:false, detectSessionInUrl:false },
  });
  const signIn = await client.auth.signInWithPassword({ email, password });
  assert.equal(signIn.error, null, `signin ${suffix}: ${signIn.error?.message ?? ''}`);
  return { userId, email, client };
}

const schoolOnlyStudent = await createIdentity({ suffix:'school-only', schoolId:schoolA, classId:classA, phone:'0905100001' });
const owner = await createIdentity({ suffix:'owner', schoolId:schoolB, classId:classB, phone:'0905100002' });
const otherStudent = await createIdentity({ suffix:'other', schoolId:schoolB, classId:classB, phone:'0905100003' });
const noPhoneStudent = await createIdentity({ suffix:'no-phone', schoolId:schoolB, classId:classB, phone:null });
const pendingStudent = await createIdentity({ suffix:'pending', schoolId:schoolB, classId:classB, accountStatus:'pending_review', membership:'needs_revalidation', phone:'0905100004' });
const teacher = await createIdentity({ suffix:'teacher', schoolId:schoolB, classId:classB, roleCode:'teacher_moderator', phone:'0905100005' });

function createArgs(overrides={}) {
  return {
    p_category_id:categoryId,
    p_title:'Sách tham khảo Vật lý lớp 11',
    p_description:'Sách còn tốt, có ghi chú nhẹ bằng bút chì và phù hợp để ôn tập.',
    p_trade_type:'give',
    p_sale_price:null,
    p_visibility_scope:'inherit',
    p_preferred_contact_method:'email',
    p_original_purchase_price:null,
    p_original_price_is_estimate:null,
    p_purchase_date:null,
    p_condition_grade:null,
    p_brand:null,
    p_model:null,
    ...overrides,
  };
}

const anonCreate = await anonymous.rpc('create_my_post', createArgs());
assert.ok(anonCreate.error, 'anonymous caller must not execute create_my_post');

const teacherCreate = await teacher.client.rpc('create_my_post', createArgs());
assert.ok(teacherCreate.error, 'teacher identity must fail Student trust gate for owner post create');

const pendingCreate = await pendingStudent.client.rpc('create_my_post', createArgs());
assert.ok(pendingCreate.error, 'pending/unverified Student must not create posts');

const widened = await schoolOnlyStudent.client.rpc('create_my_post', createArgs({ p_visibility_scope:'network' }));
assert.ok(widened.error, 'school-only tenant must not create network visibility');

const phoneMissing = await noPhoneStudent.client.rpc('create_my_post', createArgs({ p_preferred_contact_method:'phone' }));
assert.ok(phoneMissing.error, 'phone contact preference requires an underlying phone value');

const invalidSale = await owner.client.rpc('create_my_post', createArgs({
  p_trade_type:'low_price_sale', p_sale_price:50000,
  p_original_purchase_price:null, p_original_price_is_estimate:false,
  p_condition_grade:'good',
}));
assert.ok(invalidSale.error, 'low-price sale must require original purchase price');

const irrelevantSaleFields = await owner.client.rpc('create_my_post', createArgs({
  p_original_purchase_price:100000,
  p_original_price_is_estimate:false,
  p_condition_grade:'good',
}));
assert.ok(irrelevantSaleFields.error, 'non-sale post must reject sale-only estimator fields');

const created = await owner.client.rpc('create_my_post', createArgs({ p_visibility_scope:'network' }));
assert.equal(created.error, null, `verified Student create must succeed: ${created.error?.message ?? ''}`);
assert.equal(typeof created.data?.id, 'string', 'create_my_post must return server UUID');
const postId = created.data.id;

const storedIdentity = sqlValue(`
  select concat_ws('|',owner_id::text,school_id::text,coalesce(class_id::text,''),moderation_status,lifecycle_status,is_hidden::text,coalesce(published_at::text,''),visibility_scope,preferred_contact_method)
  from public.posts where id='${postId}'::uuid;
`);
assert.equal(
  storedIdentity,
  `${owner.userId}|${schoolB}|${classB}|pending|active|false||network|email`,
  'create must derive owner/school/class and trusted initial state server-side',
);

const createHistory = sqlValue(`
  select string_agg(dimension||':'||coalesce(old_value,'NULL')||'>'||new_value||':'||actor_kind||':'||source, ',' order by dimension)
  from public.post_status_history where post_id='${postId}'::uuid;
`);
assert.match(createHistory, /lifecycle:NULL>active:user:owner_action/, 'create must audit lifecycle state');
assert.match(createHistory, /moderation:NULL>pending:user:owner_action/, 'create must audit moderation state');

const validSale = await owner.client.rpc('create_my_post', createArgs({
  p_title:'Máy tính cầm tay cũ còn tốt',
  p_trade_type:'low_price_sale',
  p_sale_price:70000,
  p_original_purchase_price:180000,
  p_original_price_is_estimate:false,
  p_purchase_date:'2025-09-01',
  p_condition_grade:'good',
  p_brand:'Casio',
  p_model:'fx-580VN X',
}));
assert.equal(validSale.error, null, `valid low-price sale must succeed: ${validSale.error?.message ?? ''}`);
const saleStored = sqlValue(`
  select concat_ws('|',sale_price::text,original_purchase_price::text,original_price_is_estimate::text,condition_grade,coalesce(brand,''),coalesce(model,''))
  from public.posts where id='${validSale.data.id}'::uuid;
`);
assert.equal(saleStored, '70000|180000|false|good|Casio|fx-580VN X', 'structured sale fields must persist exactly');

const directInsert = await owner.client.from('posts').insert({
  owner_id:owner.userId, school_id:schoolB, category_id:categoryId,
  title:'Direct insert forbidden', description:'This direct browser insert must not succeed.', trade_type:'give',
}).select('id');
assert.ok(directInsert.error, 'authenticated browser must not directly INSERT posts');

const directUpdate = await owner.client.from('posts').update({ title:'Direct update forbidden' }).eq('id', postId).select('id');
assert.ok(directUpdate.error, 'authenticated browser must not directly UPDATE posts');

const directDelete = await owner.client.from('posts').delete().eq('id', postId).select('id');
assert.ok(directDelete.error, 'authenticated browser must not directly DELETE posts');

const otherEdit = await otherStudent.client.rpc('update_my_post', { p_post_id:postId, ...createArgs({ p_title:'Cross-user edit must fail' }) });
assert.ok(otherEdit.error, 'Student must not edit another user post');

sqlExec(`update public.posts set moderation_status='approved',published_at=now(),is_hidden=true,comments_enabled=false where id='${postId}'::uuid;`);
const edited = await owner.client.rpc('update_my_post', {
  p_post_id:postId,
  ...createArgs({ p_title:'Sách Vật lý 11 đã cập nhật', p_visibility_scope:'school' }),
});
assert.equal(edited.error, null, `owner edit must succeed: ${edited.error?.message ?? ''}`);
const editStored = sqlValue(`
  select concat_ws('|',title,moderation_status,coalesce(published_at::text,''),is_hidden::text,comments_enabled::text,visibility_scope)
  from public.posts where id='${postId}'::uuid;
`);
assert.equal(editStored, 'Sách Vật lý 11 đã cập nhật|pending||true|false|school', 'edit must reset moderation but preserve staff-only hidden/comments fields');
const moderationReset = sqlValue(`
  select count(*)::text from public.post_status_history
  where post_id='${postId}'::uuid and dimension='moderation' and old_value='approved' and new_value='pending' and actor_id='${owner.userId}'::uuid;
`);
assert.equal(moderationReset, '1', 'approved owner edit must audit approved → pending');

const withdrawCandidate = await owner.client.rpc('create_my_post', createArgs({ p_title:'Bài sẽ được thu hồi' }));
assert.equal(withdrawCandidate.error, null);
const withdrew = await owner.client.rpc('change_my_post_lifecycle', { p_post_id:withdrawCandidate.data.id, p_action:'withdraw' });
assert.equal(withdrew.error, null, `owner withdraw must succeed: ${withdrew.error?.message ?? ''}`);
const withdrawnState = sqlValue(`select lifecycle_status||'|'||(withdrawn_at is not null)::text from public.posts where id='${withdrawCandidate.data.id}'::uuid;`);
assert.equal(withdrawnState, 'withdrawn|true');
const editWithdrawn = await owner.client.rpc('update_my_post', { p_post_id:withdrawCandidate.data.id, ...createArgs() });
assert.ok(editWithdrawn.error, 'withdrawn post must be immutable');

const completeCandidate = await owner.client.rpc('create_my_post', createArgs({ p_title:'Bài sẽ hoàn tất sau khi được duyệt' }));
assert.equal(completeCandidate.error, null);
sqlExec(`update public.posts set moderation_status='approved',published_at=now() where id='${completeCandidate.data.id}'::uuid;`);
const completed = await owner.client.rpc('change_my_post_lifecycle', { p_post_id:completeCandidate.data.id, p_action:'complete' });
assert.equal(completed.error, null, `approved owner post may complete: ${completed.error?.message ?? ''}`);
const completedState = sqlValue(`select lifecycle_status||'|'||(completed_at is not null)::text from public.posts where id='${completeCandidate.data.id}'::uuid;`);
assert.equal(completedState, 'completed|true');
const completeAgain = await owner.client.rpc('change_my_post_lifecycle', { p_post_id:completeCandidate.data.id, p_action:'complete' });
assert.ok(completeAgain.error, 'completed post must not transition again');
const editCompleted = await owner.client.rpc('update_my_post', { p_post_id:completeCandidate.data.id, ...createArgs() });
assert.ok(editCompleted.error, 'completed post must be immutable');

const pendingComplete = await owner.client.rpc('create_my_post', createArgs({ p_title:'Bài chưa duyệt không được hoàn tất' }));
assert.equal(pendingComplete.error, null);
const pendingCompleteResult = await owner.client.rpc('change_my_post_lifecycle', { p_post_id:pendingComplete.data.id, p_action:'complete' });
assert.ok(pendingCompleteResult.error, 'pending post must not be marked completed as if it had been live');

const lifecycleHistory = sqlValue(`
  select count(*)::text from public.post_status_history
  where post_id in ('${withdrawCandidate.data.id}'::uuid,'${completeCandidate.data.id}'::uuid)
    and dimension='lifecycle' and old_value='active' and new_value in ('withdrawn','completed')
    and actor_kind='user' and source='owner_action';
`);
assert.equal(lifecycleHistory, '2', 'owner lifecycle changes must be audited');

console.log('Phase 5E trusted owner post write matrix PASS');
