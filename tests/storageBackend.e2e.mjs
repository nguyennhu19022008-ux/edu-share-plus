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

function bytes(size) {
  return new Uint8Array(size).fill(37).buffer;
}

for (const [bucket, size, mimes] of [
  ['post-media', 5242880, ['image/jpeg','image/png','image/webp']],
  ['profile-media', 3145728, ['image/jpeg','image/png','image/webp']],
  ['private-evidence', 20971520, ['image/jpeg','image/png','image/webp','application/pdf']],
]) {
  const row = sqlValue(`
    select concat_ws('|',public::text,file_size_limit::text,array_to_string(allowed_mime_types,','))
    from storage.buckets where id=${sqlLiteral(bucket)};
  `);
  assert.equal(row, `false|${size}|${mimes.join(',')}`, `${bucket} must be private with exact limits/MIME types`);
}

const storageUpdatePolicies = sqlValue(`
  select count(*)::text
  from pg_policies
  where schemaname='storage' and tablename='objects'
    and roles @> array['authenticated']::name[]
    and cmd='UPDATE';
`);
assert.equal(storageUpdatePolicies, '0', 'authenticated must not receive Storage UPDATE/upsert policy');

const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const password = 'EduShare5F!Owner1';
const schoolA = sqlValue("select id::text from public.schools where code='THPT_NGUYEN_DU' limit 1;");
assert.ok(schoolA, 'expected THPT_NGUYEN_DU seed school');
sqlExec(`update public.schools set marketplace_scope='school', is_active=true where id='${schoolA}'::uuid;`);

const schoolB = sqlValue(`
  insert into public.schools (code,name,is_active,registration_enabled,roster_verification_enabled,marketplace_scope)
  values (${sqlLiteral(`P5F_${nonce.replaceAll('-','').slice(0,14)}`)}, 'Phase 5F Other School', true, true, true, 'school')
  returning id::text;
`);

function ensureClass(schoolId, label) {
  return sqlValue(`
    insert into public.school_classes (school_id,label,grade_level,academic_year,is_active)
    values ('${schoolId}'::uuid,${sqlLiteral(label)},11,'2026-2027',true)
    returning id::text;
  `);
}

const classA = ensureClass(schoolA, `11A5F${nonce.slice(-3)}`);
const classB = ensureClass(schoolB, `11B5F${nonce.slice(-3)}`);
const categoryId = sqlValue("select id::text from public.categories where code='book' and is_active=true limit 1;");
assert.ok(categoryId, 'expected active category');

async function createIdentity({ suffix, schoolId, classId, roleCode='student', accountStatus='approved', membership='verified' }) {
  const email = `phase5f-${suffix}-${nonce}@example.test`;
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
      '${userId}'::uuid,'${schoolId}'::uuid,'${classId}'::uuid,${sqlLiteral(`Storage ${suffix}`)},${sqlLiteral(accountStatus)},
      ${sqlLiteral(membership)},${verified ? "'teacher_manual_review'" : 'null'},${verified ? 'now()' : 'null'},true,true
    );
    insert into public.profile_private (user_id,contact_email,phone,show_email,show_phone)
    values ('${userId}'::uuid,${sqlLiteral(email)},'0905999999',false,false);
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
const sameSchoolReader = await createIdentity({ suffix:'reader-a', schoolId:schoolA, classId:classA });
const otherSchoolReader = await createIdentity({ suffix:'reader-b', schoolId:schoolB, classId:classB });
const pendingStudent = await createIdentity({ suffix:'pending', schoolId:schoolA, classId:classA, accountStatus:'pending_review', membership:'needs_revalidation' });
const teacher = await createIdentity({ suffix:'teacher', schoolId:schoolA, classId:classA, roleCode:'teacher_moderator' });

function createPostArgs(title) {
  return {
    p_category_id:categoryId,
    p_title:title,
    p_description:'Bài kiểm thử private Storage Phase 5F với mô tả hợp lệ và đủ dài.',
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

const created = await owner.client.rpc('create_my_post', createPostArgs('Bài có ảnh private Phase 5F'));
assert.equal(created.error, null, `owner post create must succeed: ${created.error?.message ?? ''}`);
const postId = created.data.id;

const anonReserve = await anonymous.rpc('reserve_my_file', {
  p_purpose:'post_media', p_mime_type:'image/png', p_size_bytes:16, p_post_id:postId,
});
assert.ok(anonReserve.error, 'anonymous must not reserve files');

const pendingReserve = await pendingStudent.client.rpc('reserve_my_file', {
  p_purpose:'post_media', p_mime_type:'image/png', p_size_bytes:16, p_post_id:postId,
});
assert.ok(pendingReserve.error, 'pending/unverified Student must not reserve files');

const teacherReserve = await teacher.client.rpc('reserve_my_file', {
  p_purpose:'post_media', p_mime_type:'image/png', p_size_bytes:16, p_post_id:postId,
});
assert.ok(teacherReserve.error, 'teacher identity must not pass Student reservation gate');

const oversized = await owner.client.rpc('reserve_my_file', {
  p_purpose:'post_media', p_mime_type:'image/png', p_size_bytes:5242881, p_post_id:postId,
});
assert.ok(oversized.error, 'post image reservation must enforce 5 MiB limit');

const badMime = await owner.client.rpc('reserve_my_file', {
  p_purpose:'post_media', p_mime_type:'image/heic', p_size_bytes:16, p_post_id:postId,
});
assert.ok(badMime.error, 'unconverted HEIC must be rejected');

const arbitraryUpload = await owner.client.storage.from('post-media').upload(
  `${owner.userId}/${postId}/arbitrary.png`, bytes(16),
  { upsert:false, contentType:'image/png' },
);
assert.ok(arbitraryUpload.error, 'arbitrary unreserved Storage path must be denied');

async function reserveUploadFinalize({ purpose='post_media', post=postId, size=16, actualSize=size, mime='image/png' }={}) {
  const reservation = await owner.client.rpc('reserve_my_file', {
    p_purpose:purpose,
    p_mime_type:mime,
    p_size_bytes:size,
    p_post_id:purpose === 'post_media' ? post : null,
  });
  assert.equal(reservation.error, null, `reservation must succeed: ${reservation.error?.message ?? ''}`);

  const upload = await owner.client.storage.from(reservation.data.bucket).upload(
    reservation.data.path,
    bytes(actualSize),
    { upsert:false, contentType:mime },
  );
  assert.equal(upload.error, null, `reserved upload must succeed: ${upload.error?.message ?? ''}`);

  return { reservation:reservation.data, upload };
}

const first = await reserveUploadFinalize();
const overwriteAttempt = await owner.client.storage.from(first.reservation.bucket).upload(
  first.reservation.path,
  bytes(16),
  { upsert:false, contentType:'image/png' },
);
assert.ok(overwriteAttempt.error, 'uploading the same immutable path twice must fail');

const finalizedFirst = await owner.client.rpc('finalize_my_file', { p_file_id:first.reservation.id });
assert.equal(finalizedFirst.error, null, `finalize must accept exact Storage metadata: ${finalizedFirst.error?.message ?? ''}`);
assert.equal(finalizedFirst.data.bindingStatus, 'uploaded');

const mismatch = await reserveUploadFinalize({ size:17, actualSize:16 });
const mismatchFinalize = await owner.client.rpc('finalize_my_file', { p_file_id:mismatch.reservation.id });
assert.ok(mismatchFinalize.error, 'finalize must reject actual size mismatch');
const mismatchRemove = await owner.client.storage.from(mismatch.reservation.bucket).remove([mismatch.reservation.path]);
assert.equal(mismatchRemove.error, null, `reserved mismatch object cleanup must be allowed: ${mismatchRemove.error?.message ?? ''}`);
const mismatchTombstone = await owner.client.rpc('mark_my_file_deleted', { p_file_id:mismatch.reservation.id });
assert.equal(mismatchTombstone.error, null, 'removed reserved metadata must be tombstoned');

const bindFirst = await owner.client.rpc('bind_my_post_media', {
  p_post_id:postId,
  p_file_id:first.reservation.id,
  p_sort_order:0,
  p_is_primary:false,
  p_alt_text:'Ảnh chính',
});
assert.equal(bindFirst.error, null, `first bind must succeed: ${bindFirst.error?.message ?? ''}`);
assert.equal(bindFirst.data.isPrimary, true, 'first image must become primary');

const ownerPendingDownload = await owner.client.storage.from(first.reservation.bucket).download(first.reservation.path);
assert.equal(ownerPendingDownload.error, null, 'owner must read own pending-post media');

const readerPendingDownload = await sameSchoolReader.client.storage.from(first.reservation.bucket).download(first.reservation.path);
assert.ok(readerPendingDownload.error, 'other Student must not read pending-post media');

const crossOwnerBind = await sameSchoolReader.client.rpc('bind_my_post_media', {
  p_post_id:postId,
  p_file_id:first.reservation.id,
  p_sort_order:0,
  p_is_primary:false,
  p_alt_text:null,
});
assert.ok(crossOwnerBind.error, 'another Student must not bind owner media');

const boundDelete = await owner.client.storage.from(first.reservation.bucket).remove([first.reservation.path]);
assert.ok(boundDelete.error, 'bound post object must not be physically deleted');

const boundRows = [{ reservation:first.reservation }];
for (let index = 1; index < 5; index += 1) {
  const next = await reserveUploadFinalize({ size:16 + index, actualSize:16 + index });
  const finalized = await owner.client.rpc('finalize_my_file', { p_file_id:next.reservation.id });
  assert.equal(finalized.error, null, `finalize image ${index + 1}`);
  const bound = await owner.client.rpc('bind_my_post_media', {
    p_post_id:postId,
    p_file_id:next.reservation.id,
    p_sort_order:index,
    p_is_primary:false,
    p_alt_text:`Ảnh ${index + 1}`,
  });
  assert.equal(bound.error, null, `bind image ${index + 1}: ${bound.error?.message ?? ''}`);
  boundRows.push(next);
}

const sixth = await reserveUploadFinalize({ size:24, actualSize:24 });
const sixthFinalized = await owner.client.rpc('finalize_my_file', { p_file_id:sixth.reservation.id });
assert.equal(sixthFinalized.error, null);
const sixthBind = await owner.client.rpc('bind_my_post_media', {
  p_post_id:postId,
  p_file_id:sixth.reservation.id,
  p_sort_order:5,
  p_is_primary:false,
  p_alt_text:'Ảnh thứ sáu',
});
assert.ok(sixthBind.error, 'sixth bound image must be rejected');

sqlExec(`
  update public.posts
  set moderation_status='approved', published_at=now(), lifecycle_status='active', is_hidden=false
  where id='${postId}'::uuid;
`);

const visibleDownload = await sameSchoolReader.client.storage.from(first.reservation.bucket).download(first.reservation.path);
assert.equal(visibleDownload.error, null, `eligible same-school marketplace reader must read media: ${visibleDownload.error?.message ?? ''}`);

const invisibleDownload = await otherSchoolReader.client.storage.from(first.reservation.bucket).download(first.reservation.path);
assert.ok(invisibleDownload.error, 'other-school reader must not read school-only post media');

const avatar = await reserveUploadFinalize({ purpose:'avatar', size:20, actualSize:20 });
const avatarFinalized = await owner.client.rpc('finalize_my_file', { p_file_id:avatar.reservation.id });
assert.equal(avatarFinalized.error, null, `avatar finalize must succeed: ${avatarFinalized.error?.message ?? ''}`);
const avatarBound = await owner.client.rpc('set_my_avatar', { p_file_id:avatar.reservation.id });
assert.equal(avatarBound.error, null, `avatar bind must succeed: ${avatarBound.error?.message ?? ''}`);

const selfAvatarDownload = await owner.client.storage.from(avatar.reservation.bucket).download(avatar.reservation.path);
assert.equal(selfAvatarDownload.error, null, 'owner must read own avatar');
const crossAvatarDownload = await sameSchoolReader.client.storage.from(avatar.reservation.bucket).download(avatar.reservation.path);
assert.ok(crossAvatarDownload.error, 'another Student must not read self-only profile-media in Phase 5F');

const unbound = await owner.client.rpc('remove_my_post_media', {
  p_post_id:postId,
  p_file_id:first.reservation.id,
});
assert.equal(unbound.error, null, `owner unbind must succeed: ${unbound.error?.message ?? ''}`);
assert.equal(unbound.data.bindingStatus, 'orphaned');

const deleteAfterUnbind = await owner.client.storage.from(first.reservation.bucket).remove([first.reservation.path]);
assert.equal(deleteAfterUnbind.error, null, `orphaned object delete must succeed: ${deleteAfterUnbind.error?.message ?? ''}`);
const tombstone = await owner.client.rpc('mark_my_file_deleted', { p_file_id:first.reservation.id });
assert.equal(tombstone.error, null, `metadata tombstone must succeed: ${tombstone.error?.message ?? ''}`);
assert.equal(
  sqlValue(`select binding_status from public.file_objects where id='${first.reservation.id}'::uuid;`),
  'deleted',
  'file metadata must finish in deleted state',
);

console.log('Phase 5F private Storage integration checks passed.');
