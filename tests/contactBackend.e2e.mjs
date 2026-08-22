import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const anonKey = process.env.SUPABASE_ANON_KEY;
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.SUPABASE_DB_URL;
assert.ok(anonKey); assert.ok(secretKey); assert.ok(dbUrl);

const anonymous = createClient(supabaseUrl, anonKey, { auth:{ persistSession:false, autoRefreshToken:false, detectSessionInUrl:false } });
const authAdmin = createClient(supabaseUrl, secretKey, { auth:{ persistSession:false, autoRefreshToken:false, detectSessionInUrl:false } });
function sqlLiteral(value) { return value == null ? 'null' : `'${String(value).replaceAll("'", "''")}'`; }
function sqlValue(query) { return execFileSync('psql', [dbUrl, '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', query], { encoding:'utf8' }).trim(); }
function sqlExec(query) { execFileSync('psql', [dbUrl, '-q', '-v', 'ON_ERROR_STOP=1', '-c', query], { encoding:'utf8', stdio:['ignore','pipe','pipe'] }); }

const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const password = 'EduShare5G!Contact1';
const schoolA = sqlValue("select id::text from public.schools where code='THPT_NGUYEN_DU' limit 1;");
assert.ok(schoolA);
sqlExec(`update public.schools set marketplace_scope='school',is_active=true where id='${schoolA}'::uuid;`);
const schoolB = sqlValue(`insert into public.schools (code,name,is_active,registration_enabled,roster_verification_enabled,marketplace_scope) values (${sqlLiteral(`P5G_C_${nonce.replaceAll('-','').slice(0,12)}`)},'Phase 5G Contact Other School',true,true,true,'school') returning id::text;`);
function makeClass(schoolId,label) { return sqlValue(`insert into public.school_classes (school_id,label,grade_level,academic_year,is_active) values ('${schoolId}'::uuid,${sqlLiteral(label)},11,'2026-2027',true) returning id::text;`); }
const classA = makeClass(schoolA, `11AC5G${nonce.slice(-3)}`);
const classB = makeClass(schoolB, `11BC5G${nonce.slice(-3)}`);
const categoryId = sqlValue("select id::text from public.categories where code='book' and is_active=true limit 1;");

async function identity(suffix,{ schoolId=schoolA,classId=classA,role='student',accountStatus='approved',membership='verified',showName=true,showClass=true,showEmail=true,showPhone=true }={}) {
  const email = `phase5g-contact-${suffix}-${nonce}@example.test`;
  const phone = `0905${String(Math.floor(Math.random()*1000000)).padStart(6,'0')}`;
  const { data,error } = await authAdmin.auth.admin.createUser({ email,password,email_confirm:true });
  assert.equal(error,null);
  const userId = data.user.id;
  const verified = membership === 'verified';
  sqlExec(`
    insert into public.profiles (user_id,school_id,class_id,full_name,account_status,school_membership_status,membership_verification_method,membership_verified_at,show_name,show_class)
    values ('${userId}'::uuid,'${schoolId}'::uuid,'${classId}'::uuid,${sqlLiteral(`Contact ${suffix}`)},${sqlLiteral(accountStatus)},${sqlLiteral(membership)},${verified ? "'teacher_manual_review'" : 'null'},${verified ? 'now()' : 'null'},${showName},${showClass});
    insert into public.profile_private (user_id,contact_email,phone,show_email,show_phone)
    values ('${userId}'::uuid,${sqlLiteral(email)},${sqlLiteral(phone)},${showEmail},${showPhone});
    insert into public.user_roles (user_id,role_id,school_id) select '${userId}'::uuid,r.id,'${schoolId}'::uuid from public.roles r where r.code=${sqlLiteral(role)};
  `);
  const client = createClient(supabaseUrl,anonKey,{ auth:{ persistSession:false,autoRefreshToken:false,detectSessionInUrl:false } });
  const signed = await client.auth.signInWithPassword({ email,password });
  assert.equal(signed.error,null);
  return { userId,email,phone,client };
}

const owner = await identity('owner');
const reader = await identity('reader');
const otherSchool = await identity('other-school',{ schoolId:schoolB,classId:classB });
const pending = await identity('pending',{ accountStatus:'pending_review',membership:'needs_revalidation' });
const teacher = await identity('teacher',{ role:'teacher_moderator' });

function postArgs(title,method='email') {
  return { p_category_id:categoryId,p_title:title,p_description:'Bài kiểm thử contact Phase 5G với mô tả hợp lệ và đủ dài.',p_trade_type:'give',p_sale_price:null,p_visibility_scope:'school',p_preferred_contact_method:method,p_original_purchase_price:null,p_original_price_is_estimate:null,p_purchase_date:null,p_condition_grade:null,p_brand:null,p_model:null };
}
async function approvedPost(title,method='email') {
  const created = await owner.client.rpc('create_my_post',postArgs(title,method));
  assert.equal(created.error,null,created.error?.message ?? 'post create failed');
  sqlExec(`update public.posts set moderation_status='approved',lifecycle_status='active',is_hidden=false,completed_at=null,withdrawn_at=null,published_at=now(),preferred_contact_method=${sqlLiteral(method)} where id='${created.data.id}'::uuid;`);
  return created.data.id;
}
function contactEventCount(postId,requesterId) { return sqlValue(`select count(*)::text from public.contact_events where post_id='${postId}'::uuid and requester_id='${requesterId}'::uuid;`); }

const postId = await approvedPost('Contact email post','email');
const favorite = await reader.client.from('favorites').insert({ user_id:reader.userId,post_id:postId });
assert.equal(favorite.error,null);

// RED: reveal RPC does not exist before the Phase 5G contact migration.
const reveal = await reader.client.rpc('reveal_post_contact',{ p_post_id:postId });
assert.equal(reveal.error,null,`eligible reveal must succeed: ${reveal.error?.message ?? ''}`);
assert.equal(reveal.data.method,'email');
assert.equal(reveal.data.value,owner.email);
assert.equal(reveal.data.eventReused,false);
assert.equal(contactEventCount(postId,reader.userId),'1');

const second = await reader.client.rpc('reveal_post_contact',{ p_post_id:postId });
assert.equal(second.error,null);
assert.equal(second.data.eventReused,true);
assert.equal(second.data.eventId,reveal.data.eventId);
assert.equal(contactEventCount(postId,reader.userId),'1');

const concurrent = await Promise.all(Array.from({ length:5 },()=>reader.client.rpc('reveal_post_contact',{ p_post_id:postId })));
assert.equal(concurrent.every((result)=>result.error===null),true,'all concurrent valid reveals should succeed');
assert.equal(contactEventCount(postId,reader.userId),'1','concurrent clicks must not create duplicate audit events');

// Every click must re-check privacy even while an event is reusable.
sqlExec(`update public.profile_private set show_email=false where user_id='${owner.userId}'::uuid;`);
const privacyOff = await reader.client.rpc('reveal_post_contact',{ p_post_id:postId });
assert.ok(privacyOff.error,'privacy off must block reveal despite recent audit event');
assert.equal(contactEventCount(postId,reader.userId),'1');
// Phone exists and is enabled, but selected email must never fall back to phone.
assert.equal(String(privacyOff.data ?? '').includes(owner.phone),false);
sqlExec(`update public.profile_private set show_email=true where user_id='${owner.userId}'::uuid;`);

// Expiring the dedupe window permits a new audit event.
sqlExec(`update public.contact_events set created_at=now()-interval '16 minutes' where post_id='${postId}'::uuid and requester_id='${reader.userId}'::uuid;`);
const afterWindow = await reader.client.rpc('reveal_post_contact',{ p_post_id:postId });
assert.equal(afterWindow.error,null);
assert.equal(afterWindow.data.eventReused,false);
assert.equal(contactEventCount(postId,reader.userId),'2');

// Changing selected method during an active dedupe window must fail closed rather than reuse an email audit for phone.
sqlExec(`update public.posts set preferred_contact_method='phone' where id='${postId}'::uuid;`);
const methodChanged = await reader.client.rpc('reveal_post_contact',{ p_post_id:postId });
assert.ok(methodChanged.error,'selected method change inside dedupe window must fail closed');
assert.match(methodChanged.error.message,/EDU_SHARE_CONTACT_METHOD_CHANGED_DURING_DEDUPE/);
assert.equal(contactEventCount(postId,reader.userId),'2');

sqlExec(`update public.contact_events set created_at=now()-interval '16 minutes' where post_id='${postId}'::uuid and requester_id='${reader.userId}'::uuid;`);
const phoneReveal = await reader.client.rpc('reveal_post_contact',{ p_post_id:postId });
assert.equal(phoneReveal.error,null);
assert.equal(phoneReveal.data.method,'phone');
assert.equal(phoneReveal.data.value,owner.phone);
assert.equal(phoneReveal.data.eventReused,false);
assert.equal(contactEventCount(postId,reader.userId),'3');
assert.equal(sqlValue(`select revealed_method from public.contact_events where id='${phoneReveal.data.eventId}'::uuid;`),'phone');

sqlExec(`update public.profile_private set show_phone=false where user_id='${owner.userId}'::uuid;`);
const phonePrivacyOff = await reader.client.rpc('reveal_post_contact',{ p_post_id:postId });
assert.ok(phonePrivacyOff.error,'phone privacy off must deny phone reveal');
sqlExec(`update public.profile_private set show_phone=true where user_id='${owner.userId}'::uuid;`);

const selfReveal = await owner.client.rpc('reveal_post_contact',{ p_post_id:postId });
assert.ok(selfReveal.error,'owner self-reveal must be denied');
const pendingReveal = await pending.client.rpc('reveal_post_contact',{ p_post_id:postId });
assert.ok(pendingReveal.error,'pending Student must be denied');
const teacherReveal = await teacher.client.rpc('reveal_post_contact',{ p_post_id:postId });
assert.ok(teacherReveal.error,'teacher identity must not pass Student reveal gate');
const outOfScopeReveal = await otherSchool.client.rpc('reveal_post_contact',{ p_post_id:postId });
assert.ok(outOfScopeReveal.error,'other-school viewer must not reveal school-only contact');
const anonReveal = await anonymous.rpc('reveal_post_contact',{ p_post_id:postId });
assert.ok(anonReveal.error,'anonymous caller must not execute reveal RPC');

// Raw audit table must no longer be browser-readable or writable.
const rawRead = await reader.client.from('contact_events').select('*').eq('post_id',postId);
assert.ok(rawRead.error,'requester must not directly SELECT raw contact_events');
const rawInsert = await reader.client.from('contact_events').insert({ post_id:postId,requester_id:reader.userId,event_type:'view_contact',revealed_method:'email' });
assert.ok(rawInsert.error);
const rawUpdate = await reader.client.from('contact_events').update({ revealed_method:'email' }).eq('post_id',postId);
assert.ok(rawUpdate.error);
const rawDelete = await reader.client.from('contact_events').delete().eq('post_id',postId);
assert.ok(rawDelete.error);

const columns = sqlValue("select string_agg(column_name,',' order by ordinal_position) from information_schema.columns where table_schema='public' and table_name='contact_events';");
assert.match(columns,/(^|,)revealed_method(,|$)/);
assert.doesNotMatch(columns,/(^|,)(contact_value|revealed_value|email|phone)(,|$)/,'audit table must not duplicate revealed PII');

// Owner history uses requester's current display privacy and exposes aggregate favorite count only.
sqlExec(`update public.profiles set show_name=false,show_class=false where user_id='${reader.userId}'::uuid;`);
const history = await owner.client.rpc('list_my_post_contact_events',{ p_post_id:postId,p_limit:20 });
assert.equal(history.error,null,history.error?.message ?? 'owner history must load');
assert.equal(history.data.favoriteCount,1);
assert.equal(history.data.totalCount,3);
assert.equal(history.data.items.every((item)=>item.requesterName==='Học sinh EDU SHARE+'),true);
assert.equal(history.data.items.every((item)=>item.requesterClassName===null),true);
for (const item of history.data.items) {
  assert.equal('email' in item,false); assert.equal('phone' in item,false); assert.equal('requesterId' in item,false);
}
const nonOwnerHistory = await reader.client.rpc('list_my_post_contact_events',{ p_post_id:postId,p_limit:20 });
assert.ok(nonOwnerHistory.error,'non-owner must not read owner audit history');
const badLimit = await owner.client.rpc('list_my_post_contact_events',{ p_post_id:postId,p_limit:51 });
assert.ok(badLimit.error);

// Current post state is rechecked for every reveal.
for (const [label,stateSql] of [
  ['hidden',"is_hidden=true,moderation_status='approved',lifecycle_status='active',completed_at=null,withdrawn_at=null"],
  ['completed',"is_hidden=false,moderation_status='approved',lifecycle_status='completed',completed_at=now(),withdrawn_at=null"],
  ['withdrawn',"is_hidden=false,moderation_status='approved',lifecycle_status='withdrawn',completed_at=null,withdrawn_at=now()"],
  ['rejected',"is_hidden=false,moderation_status='rejected',lifecycle_status='active',completed_at=null,withdrawn_at=null"],
]) {
  sqlExec(`update public.posts set ${stateSql} where id='${postId}'::uuid;`);
  const denied = await reader.client.rpc('reveal_post_contact',{ p_post_id:postId });
  assert.ok(denied.error,`${label} post must deny contact reveal`);
}

console.log('Phase 5G contact backend matrix passed');
