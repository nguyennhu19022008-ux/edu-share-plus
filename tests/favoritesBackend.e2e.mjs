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
const password = 'EduShare5G!Favorite1';
const schoolA = sqlValue("select id::text from public.schools where code='THPT_NGUYEN_DU' limit 1;");
assert.ok(schoolA, 'expected THPT_NGUYEN_DU seed school');
sqlExec(`update public.schools set marketplace_scope='school', is_active=true where id='${schoolA}'::uuid;`);

const schoolB = sqlValue(`
  insert into public.schools (code,name,is_active,registration_enabled,roster_verification_enabled,marketplace_scope)
  values (${sqlLiteral(`P5G_F_${nonce.replaceAll('-','').slice(0,12)}`)}, 'Phase 5G Favorite Other School', true, true, true, 'school')
  returning id::text;
`);

function ensureClass(schoolId, label) {
  return sqlValue(`
    insert into public.school_classes (school_id,label,grade_level,academic_year,is_active)
    values ('${schoolId}'::uuid,${sqlLiteral(label)},11,'2026-2027',true)
    returning id::text;
  `);
}

const classA = ensureClass(schoolA, `11A5GF${nonce.slice(-3)}`);
const classB = ensureClass(schoolB, `11B5GF${nonce.slice(-3)}`);
const categoryId = sqlValue("select id::text from public.categories where code='book' and is_active=true limit 1;");
assert.ok(categoryId, 'expected active book category');

async function createIdentity({ suffix, schoolId, classId, roleCode='student', accountStatus='approved', membership='verified' }) {
  const email = `phase5g-fav-${suffix}-${nonce}@example.test`;
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
      '${userId}'::uuid,'${schoolId}'::uuid,'${classId}'::uuid,${sqlLiteral(`Favorite ${suffix}`)},${sqlLiteral(accountStatus)},
      ${sqlLiteral(membership)},${verified ? "'teacher_manual_review'" : 'null'},${verified ? 'now()' : 'null'},true,true
    );
    insert into public.profile_private (user_id,contact_email,phone,show_email,show_phone)
    values ('${userId}'::uuid,${sqlLiteral(email)},'0905111111',true,true);
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

const owner = await createIdentity({ suffix:'owner', schoolId:schoolA, classId:classA });
const reader = await createIdentity({ suffix:'reader', schoolId:schoolA, classId:classA });
const reader2 = await createIdentity({ suffix:'reader2', schoolId:schoolA, classId:classA });
const otherReader = await createIdentity({ suffix:'other-school', schoolId:schoolB, classId:classB });
const pendingStudent = await createIdentity({
  suffix:'pending', schoolId:schoolA, classId:classA,
  accountStatus:'pending_review', membership:'needs_revalidation',
});
const teacher = await createIdentity({ suffix:'teacher', schoolId:schoolA, classId:classA, roleCode:'teacher_moderator' });

function createPostArgs(title, visibility='school') {
  return {
    p_category_id:categoryId,
    p_title:title,
    p_description:'Bài kiểm thử favorites Phase 5G với mô tả đủ dài để qua validation.',
    p_trade_type:'give',
    p_sale_price:null,
    p_visibility_scope:visibility,
    p_preferred_contact_method:'email',
    p_original_purchase_price:null,
    p_original_price_is_estimate:null,
    p_purchase_date:null,
    p_condition_grade:null,
    p_brand:null,
    p_model:null,
  };
}

async function createApprovedPost(title, visibility='school') {
  const created = await owner.client.rpc('create_my_post', createPostArgs(title, visibility));
  assert.equal(created.error, null, `create ${title}: ${created.error?.message ?? ''}`);
  const postId = created.data.id;
  sqlExec(`
    update public.posts
    set moderation_status='approved', lifecycle_status='active', is_hidden=false,
        published_at=now(), visibility_scope=${sqlLiteral(visibility)}
    where id='${postId}'::uuid;
  `);
  return postId;
}

const postId = await createApprovedPost('Favorite school-scope post');

// RED contract: the old Phase 5 policy still allows this, so Task 1 must fail here before migration.
const selfFavorite = await owner.client.from('favorites').insert({ user_id:owner.userId, post_id:postId });
assert.ok(selfFavorite.error, 'owner must not favorite own post');
assert.equal(
  sqlValue(`select count(*)::text from public.favorites where user_id='${owner.userId}'::uuid and post_id='${postId}'::uuid;`),
  '0',
  'denied owner self-favorite must not persist',
);

const save = await reader.client.from('favorites').insert({ user_id:reader.userId, post_id:postId });
assert.equal(save.error, null, `eligible same-school save must succeed: ${save.error?.message ?? ''}`);
assert.equal(
  sqlValue(`select count(*)::text from public.favorites where user_id='${reader.userId}'::uuid and post_id='${postId}'::uuid;`),
  '1',
  'save must persist exactly one row',
);

const duplicate = await reader.client.from('favorites').insert({ user_id:reader.userId, post_id:postId });
assert.ok(duplicate.error, 'favorite primary key must reject duplicate rows');

const spoof = await reader2.client.from('favorites').insert({ user_id:reader.userId, post_id:postId });
assert.ok(spoof.error, 'caller must not favorite on behalf of another user');

const otherRead = await otherReader.client.from('favorites').select('user_id,post_id').eq('user_id', reader.userId).eq('post_id', postId);
assert.equal(otherRead.error, null);
assert.deepEqual(otherRead.data, [], 'favorite identity must remain private to the saving user');

await otherReader.client.from('favorites').delete().eq('user_id', reader.userId).eq('post_id', postId);
assert.equal(
  sqlValue(`select count(*)::text from public.favorites where user_id='${reader.userId}'::uuid and post_id='${postId}'::uuid;`),
  '1',
  'another user must not delete the saver favorite row',
);

const pendingSave = await pendingStudent.client.from('favorites').insert({ user_id:pendingStudent.userId, post_id:postId });
assert.ok(pendingSave.error, 'pending/unverified Student must not favorite posts');

const teacherSave = await teacher.client.from('favorites').insert({ user_id:teacher.userId, post_id:postId });
assert.ok(teacherSave.error, 'teacher identity must not pass Student marketplace favorite gate');

const outOfScopeSave = await otherReader.client.from('favorites').insert({ user_id:otherReader.userId, post_id:postId });
assert.ok(outOfScopeSave.error, 'other-school reader must not favorite a school-only post');

const saved = await reader.client.rpc('list_my_saved_posts', { p_limit:20, p_offset:0 });
assert.equal(saved.error, null, `saved-post projection must exist: ${saved.error?.message ?? ''}`);
assert.equal(saved.data.totalCount, 1);
assert.equal(saved.data.items.length, 1);
assert.equal(saved.data.items[0].id, postId);
assert.equal(saved.data.items[0].favoriteCount, 1);

const detail = await reader.client.rpc('get_marketplace_post', { p_post_id:postId });
assert.equal(detail.error, null);
assert.equal(detail.data.viewerSaved, true, 'detail must expose current viewer saved state');
assert.equal(detail.data.viewerOwnsPost, false, 'reader must not be marked as owner');
assert.equal(detail.data.post.favoriteCount, 1, 'favorite count must be backend-derived');

const ownerDetail = await owner.client.rpc('get_marketplace_post', { p_post_id:postId });
assert.equal(ownerDetail.error, null);
assert.equal(ownerDetail.data.viewerSaved, false, 'owner cannot have a saved state for own post');
assert.equal(ownerDetail.data.viewerOwnsPost, true, 'detail must expose owner state without returning owner UUID');

const directUpdate = await reader.client.from('favorites').update({ post_id:postId }).eq('user_id', reader.userId).eq('post_id', postId);
assert.ok(directUpdate.error, 'authenticated browser must not have favorites UPDATE privilege');

sqlExec(`update public.posts set is_hidden=true where id='${postId}'::uuid;`);
const hiddenSaved = await reader.client.rpc('list_my_saved_posts', { p_limit:20, p_offset:0 });
assert.equal(hiddenSaved.error, null);
assert.equal(hiddenSaved.data.totalCount, 0, 'saved projection must hide posts that are no longer marketplace-readable');
assert.equal(
  sqlValue(`select count(*)::text from public.favorites where user_id='${reader.userId}'::uuid and post_id='${postId}'::uuid;`),
  '1',
  'visibility loss must not silently destroy the favorite row',
);

sqlExec(`update public.posts set is_hidden=false where id='${postId}'::uuid;`);
const unsave = await reader.client.from('favorites').delete().eq('user_id', reader.userId).eq('post_id', postId);
assert.equal(unsave.error, null, `self unsave must succeed: ${unsave.error?.message ?? ''}`);
assert.equal(
  sqlValue(`select count(*)::text from public.favorites where user_id='${reader.userId}'::uuid and post_id='${postId}'::uuid;`),
  '0',
  'unsave must remove the own favorite row',
);

for (const [label, stateSql] of [
  ['hidden', "is_hidden=true, moderation_status='approved', lifecycle_status='active'"],
  ['completed', "is_hidden=false, moderation_status='approved', lifecycle_status='completed'"],
  ['withdrawn', "is_hidden=false, moderation_status='approved', lifecycle_status='withdrawn'"],
  ['rejected', "is_hidden=false, moderation_status='rejected', lifecycle_status='active'"],
]) {
  sqlExec(`update public.posts set ${stateSql} where id='${postId}'::uuid;`);
  const denied = await reader.client.from('favorites').insert({ user_id:reader.userId, post_id:postId });
  assert.ok(denied.error, `${label} post must not accept a new favorite`);
}

sqlExec(`
  update public.posts
  set is_hidden=false, moderation_status='approved', lifecycle_status='active', published_at=now()
  where id='${postId}'::uuid;
`);

// Network visibility: when the source school enables network marketplace, an eligible Student from another school may save a network post.
sqlExec(`update public.schools set marketplace_scope='network' where id='${schoolA}'::uuid;`);
const networkPostId = await createApprovedPost('Favorite network-scope post', 'network');
const networkSave = await otherReader.client.from('favorites').insert({ user_id:otherReader.userId, post_id:networkPostId });
assert.equal(networkSave.error, null, `network-visible favorite must succeed: ${networkSave.error?.message ?? ''}`);

const networkList = await otherReader.client.rpc('list_my_saved_posts', { p_limit:20, p_offset:0 });
assert.equal(networkList.error, null);
assert.equal(networkList.data.items.some((item) => item.id === networkPostId), true, 'network saved post must appear for eligible reader');

const badLimit = await reader.client.rpc('list_my_saved_posts', { p_limit:51, p_offset:0 });
assert.ok(badLimit.error, 'saved-post projection must cap limit at 50');
const badOffset = await reader.client.rpc('list_my_saved_posts', { p_limit:20, p_offset:-1 });
assert.ok(badOffset.error, 'saved-post projection must reject negative offsets');

console.log('Phase 5G favorites backend matrix passed');
