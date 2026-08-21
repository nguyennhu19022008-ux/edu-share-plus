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
  auth:{ persistSession:false, autoRefreshToken:false, detectSessionInUrl:false },
});
const anonymous = createClient(supabaseUrl, anonKey, {
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

const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const password = 'EduShare5E!ReadMatrix';
const schoolId = sqlValue("select id::text from public.schools where code='THPT_NGUYEN_DU' limit 1;");
const categoryId = sqlValue("select id::text from public.categories where code='book' and is_active=true limit 1;");
assert.ok(schoolId, 'expected seeded school');
assert.ok(categoryId, 'expected seeded category');
sqlExec(`update public.schools set marketplace_scope='network',is_active=true where id='${schoolId}'::uuid;`);

const classId = sqlValue(`
  insert into public.school_classes (school_id,label,grade_level,academic_year,is_active)
  values ('${schoolId}'::uuid,${sqlLiteral(`11R${nonce.slice(-5)}`)},11,'2026-2027',true)
  returning id::text;
`);

async function makeStudent(suffix, phone) {
  const email = `phase5e-read-${suffix}-${nonce}@example.test`;
  const created = await authAdmin.auth.admin.createUser({ email, password, email_confirm:true });
  assert.equal(created.error, null, `create ${suffix}: ${created.error?.message ?? ''}`);
  const userId = created.data.user.id;

  sqlExec(`
    insert into public.profiles (
      user_id,school_id,class_id,full_name,account_status,
      school_membership_status,membership_verification_method,membership_verified_at,
      show_name,show_class
    ) values (
      '${userId}'::uuid,'${schoolId}'::uuid,'${classId}'::uuid,${sqlLiteral(`Read ${suffix}`)},'approved',
      'verified','teacher_manual_review',now(),true,true
    );
    insert into public.profile_private (user_id,contact_email,phone,show_email,show_phone)
    values ('${userId}'::uuid,${sqlLiteral(email)},${sqlLiteral(phone)},false,false);
    insert into public.user_roles (user_id,role_id,school_id)
    select '${userId}'::uuid,r.id,'${schoolId}'::uuid from public.roles r where r.code='student';
  `);

  const client = createClient(supabaseUrl, anonKey, {
    auth:{ persistSession:false, autoRefreshToken:false, detectSessionInUrl:false },
  });
  const signedIn = await client.auth.signInWithPassword({ email, password });
  assert.equal(signedIn.error, null, `signin ${suffix}: ${signedIn.error?.message ?? ''}`);
  return { userId, email, client };
}

const owner = await makeStudent('owner', '0905200001');
const other = await makeStudent('other', '0905200002');

function createArgs(title) {
  return {
    p_category_id:categoryId,
    p_title:title,
    p_description:`${title} description with enough detail for owner read testing.`,
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
  };
}

const first = await owner.client.rpc('create_my_post', createArgs('Physics Search Alpha'));
const second = await owner.client.rpc('create_my_post', createArgs('Mathematics Beta Book'));
assert.equal(first.error, null, `owner create first: ${first.error?.message ?? ''}`);
assert.equal(second.error, null, `owner create second: ${second.error?.message ?? ''}`);
const firstId = first.data.id;

const ownerSelect = [
  'id','title','description','trade_type','sale_price','moderation_status','lifecycle_status',
  'visibility_scope','preferred_contact_method','original_purchase_price','original_price_is_estimate',
  'purchase_date','condition_grade','brand','model','is_hidden','comments_enabled','created_at','updated_at',
  'published_at','completed_at','withdrawn_at',
  'category:categories!posts_category_fk(id,name)',
  'class:school_classes!posts_class_scope_fk(id,label)',
].join(',');

const paged = await owner.client
  .from('posts')
  .select(ownerSelect, { count:'exact' })
  .eq('owner_id', owner.userId)
  .order('created_at', { ascending:false })
  .range(0, 0);
assert.equal(paged.error, null, `owner paged read: ${paged.error?.message ?? ''}`);
assert.equal(paged.count, 2, 'exact count must include both owner rows');
assert.equal(paged.data.length, 1, 'range must page owner rows server-side');
assert.equal(typeof paged.data[0].category?.id, 'string', 'category relation must be readable');
assert.equal(paged.data[0].class?.id, classId, 'class relation must be readable for the owner post');

const searched = await owner.client
  .from('posts')
  .select('id,title', { count:'exact' })
  .eq('owner_id', owner.userId)
  .textSearch('search_tsv', 'Physics', { type:'websearch', config:'simple' })
  .range(0, 11);
assert.equal(searched.error, null, `owner search: ${searched.error?.message ?? ''}`);
assert.equal(searched.count, 1, 'server text search must narrow owner rows');
assert.deepEqual(searched.data.map((row) => row.id), [firstId]);

const ownerDetail = await owner.client
  .from('posts')
  .select(ownerSelect)
  .eq('owner_id', owner.userId)
  .eq('id', firstId)
  .maybeSingle();
assert.equal(ownerDetail.error, null, `owner detail: ${ownerDetail.error?.message ?? ''}`);
assert.equal(ownerDetail.data?.id, firstId, 'owner must read own pending post detail');

const otherDetail = await other.client
  .from('posts')
  .select('id')
  .eq('owner_id', other.userId)
  .eq('id', firstId)
  .maybeSingle();
assert.equal(otherDetail.error, null, `cross-owner filtered read should safely resolve empty: ${otherDetail.error?.message ?? ''}`);
assert.equal(otherDetail.data, null, 'other Student must not read another owners pending post');

const ownerHistory = await owner.client
  .from('post_status_history')
  .select('id,dimension,old_value,new_value,reason,created_at')
  .eq('post_id', firstId)
  .order('created_at', { ascending:false });
assert.equal(ownerHistory.error, null, `owner history: ${ownerHistory.error?.message ?? ''}`);
assert.ok(ownerHistory.data.length >= 2, 'owner must read trusted create history');
assert.ok(ownerHistory.data.some((row) => row.dimension === 'moderation' && row.new_value === 'pending'));

const otherHistory = await other.client
  .from('post_status_history')
  .select('id')
  .eq('post_id', firstId);
assert.equal(otherHistory.error, null, `cross-owner history should safely resolve empty: ${otherHistory.error?.message ?? ''}`);
assert.equal(otherHistory.data.length, 0, 'other Student must not read owner-only history');

const context = await owner.client.rpc('get_current_student_context');
assert.equal(context.error, null, `owner context: ${context.error?.message ?? ''}`);
assert.equal(context.data.user_id, owner.userId);
assert.equal(context.data.school_id, schoolId);
assert.equal(context.data.class_id, classId);

const privateProfile = await owner.client
  .from('profile_private')
  .select('contact_email,phone')
  .eq('user_id', owner.userId)
  .maybeSingle();
assert.equal(privateProfile.error, null, `profile private self read: ${privateProfile.error?.message ?? ''}`);
assert.equal(privateProfile.data?.contact_email, owner.email);

const categoryReference = await owner.client.from('categories').select('id,name').eq('is_active', true).limit(1);
assert.equal(categoryReference.error, null, `category reference: ${categoryReference.error?.message ?? ''}`);
assert.ok(categoryReference.data.length >= 1);
const schoolReference = await owner.client.from('schools').select('marketplace_scope').eq('id', schoolId).maybeSingle();
assert.equal(schoolReference.error, null, `school policy reference: ${schoolReference.error?.message ?? ''}`);
assert.equal(schoolReference.data?.marketplace_scope, 'network');

const anonymousPending = await anonymous.from('posts').select('id').eq('id', firstId);
assert.equal(anonymousPending.error, null);
assert.equal(anonymousPending.data.length, 0, 'anonymous direct SELECT must expose no owner post');

console.log('Phase 5E owner post read RLS + pagination matrix PASS');
