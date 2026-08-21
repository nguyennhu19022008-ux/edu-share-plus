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
  return execFileSync('psql', [dbUrl, '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', query], { encoding:'utf8' }).trim();
}

function sqlExec(query) {
  execFileSync('psql', [dbUrl, '-q', '-v', 'ON_ERROR_STOP=1', '-c', query], {
    encoding:'utf8', stdio:['ignore','pipe','pipe'],
  });
}

const scopeColumnCount = sqlValue(`
  select count(*)::text
  from information_schema.columns
  where table_schema='public'
    and ((table_name='schools' and column_name='marketplace_scope')
      or (table_name='posts' and column_name='visibility_scope'));
`);
assert.equal(scopeColumnCount, '2', 'Phase 5C marketplace scope columns must exist');

const anonPostPolicy = sqlValue(`
  select count(*)::text from pg_policies
  where schemaname='public' and tablename='posts'
    and 'anon'=any(roles) and cmd='SELECT';
`);
assert.equal(anonPostPolicy, '0', 'anonymous users must have no post SELECT policy');

const anonMediaPolicy = sqlValue(`
  select count(*)::text from pg_policies
  where schemaname='public' and tablename='post_media'
    and 'anon'=any(roles) and cmd='SELECT';
`);
assert.equal(anonMediaPolicy, '0', 'anonymous users must have no post_media SELECT policy');

const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const password = 'EduShare5C!Marketplace';

const schoolA = sqlValue("select id::text from public.schools where code='THPT_NGUYEN_DU' limit 1;");
assert.ok(schoolA, 'expected THPT_NGUYEN_DU seed school');
const schoolB = sqlValue(`
  insert into public.schools (code, name, is_active, registration_enabled, roster_verification_enabled, marketplace_scope)
  values ('PHASE5C_${nonce.replaceAll('-', '').slice(0,12)}', 'Phase 5C School B', true, true, true, 'school')
  returning id::text;
`);

sqlExec(`
  update public.schools set marketplace_scope='network' where id='${schoolA}'::uuid;
  update public.schools set marketplace_scope='school' where id='${schoolB}'::uuid;
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
const classA = ensureClass(schoolA, '11A01');
const classB = ensureClass(schoolB, '11B01');
const categoryId = sqlValue("select id::text from public.categories where code='book' limit 1;");
assert.ok(categoryId, 'expected active book category');

async function makeStudent({ suffix, schoolId, classId, accountStatus='approved', membershipStatus='verified', confirmed=true }) {
  const email = `phase5c-${suffix}-${nonce}@example.test`;
  const { data, error } = await authAdmin.auth.admin.createUser({ email, password, email_confirm:true });
  assert.equal(error, null, `create ${suffix}: ${error?.message ?? ''}`);
  const userId = data.user.id;

  const verified = membershipStatus === 'verified';
  sqlExec(`
    insert into public.profiles (
      user_id, school_id, class_id, full_name, account_status,
      school_membership_status, membership_verification_method, membership_verified_at
    ) values (
      '${userId}'::uuid, '${schoolId}'::uuid, '${classId}'::uuid, ${sqlLiteral(`Student ${suffix}`)},
      ${sqlLiteral(accountStatus)}, ${sqlLiteral(membershipStatus)},
      ${sqlLiteral(verified ? 'teacher_manual_review' : null)}, ${verified ? 'now()' : 'null'}
    );
    insert into public.user_roles (user_id, role_id, school_id)
    select '${userId}'::uuid, r.id, '${schoolId}'::uuid from public.roles r where r.code='student';
  `);

  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession:false, autoRefreshToken:false, detectSessionInUrl:false },
  });
  const signIn = await client.auth.signInWithPassword({ email, password });
  assert.equal(signIn.error, null, `signin ${suffix}: ${signIn.error?.message ?? ''}`);

  if (!confirmed) {
    // Keep the already-issued JWT so the RPC receives auth.uid(), then remove
    // confirmation evidence in auth.users. The trusted eligibility helper must
    // still deny the session.
    sqlExec(`update auth.users set email_confirmed_at=null where id='${userId}'::uuid;`);
  }
  return { userId, client };
}

const studentA = await makeStudent({ suffix:'a', schoolId:schoolA, classId:classA });
const studentB = await makeStudent({ suffix:'b', schoolId:schoolB, classId:classB });
const needsRevalidation = await makeStudent({
  suffix:'needs-revalidation', schoolId:schoolA, classId:classA,
  membershipStatus:'needs_revalidation',
});
const pending = await makeStudent({
  suffix:'pending', schoolId:schoolA, classId:classA,
  accountStatus:'pending_review', membershipStatus:'needs_revalidation',
});
const unconfirmed = await makeStudent({ suffix:'unconfirmed', schoolId:schoolA, classId:classA, confirmed:false });

function insertPost({ ownerId, schoolId, classId, title, tradeType='give', salePrice=null, visibility='inherit', moderation='approved', lifecycle='active', hidden=false }) {
  const isSale = tradeType === 'low_price_sale';
  const originalPrice = isSale ? Math.max(Number(salePrice || 1) * 2, 1) : null;
  return sqlValue(`
    insert into public.posts (
      owner_id, school_id, class_id, category_id, title, description, trade_type,
      sale_price, moderation_status, lifecycle_status, is_hidden, comments_enabled,
      published_at, completed_at, withdrawn_at, visibility_scope,
      original_purchase_price, original_price_is_estimate, condition_grade
    ) values (
      '${ownerId}'::uuid, '${schoolId}'::uuid, '${classId}'::uuid, '${categoryId}'::uuid,
      ${sqlLiteral(title)}, ${sqlLiteral(`${title} description keyword-${title.toLowerCase().replaceAll(' ', '-')}`)},
      ${sqlLiteral(tradeType)}, ${salePrice === null ? 'null' : Number(salePrice)},
      ${sqlLiteral(moderation)}, ${sqlLiteral(lifecycle)}, ${hidden ? 'true' : 'false'}, true,
      case when ${sqlLiteral(moderation)}='approved' then now() else null end,
      case when ${sqlLiteral(lifecycle)}='completed' then now() else null end,
      case when ${sqlLiteral(lifecycle)}='withdrawn' then now() else null end,
      ${sqlLiteral(visibility)},
      ${originalPrice === null ? 'null' : originalPrice},
      ${isSale ? 'false' : 'null'},
      ${isSale ? "'good'" : 'null'}
    ) returning id::text;
  `);
}

const networkA = insertPost({ ownerId:studentA.userId, schoolId:schoolA, classId:classA, title:'Network Book A', visibility:'inherit' });
const schoolOnlyA = insertPost({ ownerId:studentA.userId, schoolId:schoolA, classId:classA, title:'School Book A', visibility:'school', tradeType:'low_price_sale', salePrice:120000 });
const cannotWidenB = insertPost({ ownerId:studentB.userId, schoolId:schoolB, classId:classB, title:'School Policy B', visibility:'network', tradeType:'low_price_sale', salePrice:80000 });
insertPost({ ownerId:studentA.userId, schoolId:schoolA, classId:classA, title:'Hidden A', hidden:true });
insertPost({ ownerId:studentA.userId, schoolId:schoolA, classId:classA, title:'Pending A', moderation:'pending' });
insertPost({ ownerId:studentA.userId, schoolId:schoolA, classId:classA, title:'Completed A', lifecycle:'completed' });

const fileId = sqlValue(`
  insert into public.file_objects (
    owner_id, bucket, storage_path, purpose, visibility, mime_type, size_bytes, width, height
  ) values (
    '${studentA.userId}'::uuid, 'post-media', ${sqlLiteral(`phase5c/${nonce}/cover.webp`)},
    'post_media', 'private', 'image/webp', 1024, 100, 100
  ) returning id::text;
`);
sqlExec(`insert into public.post_media (post_id, file_id, sort_order, is_primary) values ('${networkA}'::uuid, '${fileId}'::uuid, 0, true);`);
sqlExec(`insert into public.favorites (user_id, post_id) values ('${studentB.userId}'::uuid, '${networkA}'::uuid);`);

const rpcArgs = {
  p_keyword:null,
  p_trade_type:null,
  p_category_id:null,
  p_class_id:null,
  p_sort:'new',
  p_page:1,
  p_page_size:12,
};

async function expectDenied(client, label) {
  const result = await client.rpc('list_marketplace_posts', rpcArgs);
  assert.ok(result.error, `${label} marketplace RPC must be denied`);
}
await expectDenied(anonymous, 'anonymous');
await expectDenied(needsRevalidation.client, 'needs_revalidation');
await expectDenied(pending.client, 'pending');
await expectDenied(unconfirmed.client, 'unconfirmed');

const feedA = await studentA.client.rpc('list_marketplace_posts', rpcArgs);
assert.equal(feedA.error, null, `student A feed: ${feedA.error?.message ?? ''}`);
const idsA = new Set(feedA.data.items.map((item) => item.id));
assert.ok(idsA.has(networkA));
assert.ok(idsA.has(schoolOnlyA));
assert.ok(!idsA.has(cannotWidenB), 'school-scoped School B post cannot widen via post visibility=network');
assert.equal(feedA.data.totalCount, 2);
assert.equal(feedA.data.stats.totalOpen, 2);
assert.equal(feedA.data.stats.hasImage, 1);

const feedB = await studentB.client.rpc('list_marketplace_posts', rpcArgs);
assert.equal(feedB.error, null, `student B feed: ${feedB.error?.message ?? ''}`);
const idsB = new Set(feedB.data.items.map((item) => item.id));
assert.ok(idsB.has(networkA), 'network School A inherit post must be cross-school visible');
assert.ok(idsB.has(cannotWidenB), 'same-school student can see own-school post');
assert.ok(!idsB.has(schoolOnlyA), 'explicit school post narrows network school');
assert.equal(feedB.data.items.find((item) => item.id === networkA)?.favoriteCount, 1);
assert.equal(feedB.data.items.find((item) => item.id === networkA)?.hasImage, true);

const saleAsc = await studentA.client.rpc('list_marketplace_posts', { ...rpcArgs, p_trade_type:'low_price_sale', p_sort:'priceAsc' });
assert.equal(saleAsc.error, null);
assert.deepEqual(saleAsc.data.items.map((item) => item.id), [schoolOnlyA]);

const keyword = await studentB.client.rpc('list_marketplace_posts', { ...rpcArgs, p_keyword:'Network Book' });
assert.equal(keyword.error, null);
assert.deepEqual(keyword.data.items.map((item) => item.id), [networkA]);

const classFilter = await studentA.client.rpc('list_marketplace_posts', { ...rpcArgs, p_class_id:classA });
assert.equal(classFilter.error, null);
assert.equal(classFilter.data.totalCount, 2);

const imageFirst = await studentA.client.rpc('list_marketplace_posts', { ...rpcArgs, p_sort:'image' });
assert.equal(imageFirst.error, null);
assert.equal(imageFirst.data.items[0]?.id, networkA, 'image sort must place imaged post first');

const pageOne = await studentA.client.rpc('list_marketplace_posts', { ...rpcArgs, p_page_size:1, p_page:1 });
const pageTwo = await studentA.client.rpc('list_marketplace_posts', { ...rpcArgs, p_page_size:1, p_page:2 });
assert.equal(pageOne.error, null);
assert.equal(pageTwo.error, null);
assert.equal(pageOne.data.totalCount, 2);
assert.equal(pageOne.data.totalPages, 2);
assert.notEqual(pageOne.data.items[0].id, pageTwo.data.items[0].id);

const detailCrossSchool = await studentB.client.rpc('get_marketplace_post', { p_post_id:networkA });
assert.equal(detailCrossSchool.error, null, `network detail should be visible: ${detailCrossSchool.error?.message ?? ''}`);
assert.equal(detailCrossSchool.data.post.id, networkA);

const detailSchoolOnly = await studentB.client.rpc('get_marketplace_post', { p_post_id:schoolOnlyA });
assert.ok(detailSchoolOnly.error, 'cross-school student must not read school-only detail');

const anonPosts = await anonymous.from('posts').select('id');
assert.equal(anonPosts.error, null);
assert.equal(anonPosts.data.length, 0, 'anonymous direct posts SELECT must expose zero rows');
const anonMedia = await anonymous.from('post_media').select('id');
assert.equal(anonMedia.error, null);
assert.equal(anonMedia.data.length, 0, 'anonymous direct post_media SELECT must expose zero rows');

console.log('Phase 5C marketplace read matrix PASS');
