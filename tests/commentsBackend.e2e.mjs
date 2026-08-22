import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const anonKey = process.env.SUPABASE_ANON_KEY;
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.SUPABASE_DB_URL;
assert.ok(anonKey); assert.ok(secretKey); assert.ok(dbUrl);

const authAdmin = createClient(supabaseUrl, secretKey, { auth:{ persistSession:false, autoRefreshToken:false, detectSessionInUrl:false } });
function sqlLiteral(value) { return value == null ? 'null' : `'${String(value).replaceAll("'", "''")}'`; }
function sqlValue(query) { return execFileSync('psql', [dbUrl, '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', query], { encoding:'utf8' }).trim(); }
function sqlExec(query) { execFileSync('psql', [dbUrl, '-q', '-v', 'ON_ERROR_STOP=1', '-c', query], { encoding:'utf8', stdio:['ignore','pipe','pipe'] }); }

const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const password = 'EduShare5G!Comments1';
const schoolId = sqlValue("select id::text from public.schools where code='THPT_NGUYEN_DU' limit 1;");
assert.ok(schoolId);
sqlExec(`update public.schools set marketplace_scope='school',is_active=true where id='${schoolId}'::uuid;`);
const classId = sqlValue(`insert into public.school_classes (school_id,label,grade_level,academic_year,is_active) values ('${schoolId}'::uuid,${sqlLiteral(`11C5G${nonce.slice(-4)}`)},11,'2026-2027',true) returning id::text;`);
const categoryId = sqlValue("select id::text from public.categories where code='book' and is_active=true limit 1;");

async function identity(suffix, options={}) {
  const email = `phase5g-comments-${suffix}-${nonce}@example.test`;
  const { data, error } = await authAdmin.auth.admin.createUser({ email, password, email_confirm:true });
  assert.equal(error, null);
  const userId = data.user.id;
  const accountStatus = options.accountStatus ?? 'approved';
  const membership = options.membership ?? 'verified';
  const verified = membership === 'verified';
  const role = options.role ?? 'student';
  sqlExec(`
    insert into public.profiles (user_id,school_id,class_id,full_name,account_status,school_membership_status,membership_verification_method,membership_verified_at,show_name,show_class)
    values ('${userId}'::uuid,'${schoolId}'::uuid,'${classId}'::uuid,${sqlLiteral(`Comment ${suffix}`)},${sqlLiteral(accountStatus)},${sqlLiteral(membership)},${verified ? "'teacher_manual_review'" : 'null'},${verified ? 'now()' : 'null'},true,true);
    insert into public.profile_private (user_id,contact_email,phone,show_email,show_phone) values ('${userId}'::uuid,${sqlLiteral(email)},'0905222222',true,true);
    insert into public.user_roles (user_id,role_id,school_id) select '${userId}'::uuid,r.id,'${schoolId}'::uuid from public.roles r where r.code=${sqlLiteral(role)};
  `);
  const client = createClient(supabaseUrl, anonKey, { auth:{ persistSession:false, autoRefreshToken:false, detectSessionInUrl:false } });
  const signed = await client.auth.signInWithPassword({ email, password });
  assert.equal(signed.error, null);
  return { userId, email, client };
}

const owner = await identity('owner');
const reader = await identity('reader');
const reader2 = await identity('reader2');
const pending = await identity('pending', { accountStatus:'pending_review', membership:'needs_revalidation' });
const teacher = await identity('teacher', { role:'teacher_moderator' });

function postArgs(title) {
  return {
    p_category_id:categoryId, p_title:title,
    p_description:'Bài kiểm thử comments Phase 5G với mô tả hợp lệ và đủ dài.',
    p_trade_type:'give', p_sale_price:null, p_visibility_scope:'school', p_preferred_contact_method:'email',
    p_original_purchase_price:null, p_original_price_is_estimate:null, p_purchase_date:null,
    p_condition_grade:null, p_brand:null, p_model:null,
  };
}
async function approvedPost(title) {
  const result = await owner.client.rpc('create_my_post', postArgs(title));
  assert.equal(result.error, null, result.error?.message ?? 'post create failed');
  sqlExec(`update public.posts set moderation_status='approved',lifecycle_status='active',is_hidden=false,comments_enabled=true,completed_at=null,withdrawn_at=null,published_at=now() where id='${result.data.id}'::uuid;`);
  return result.data.id;
}

const postId = await approvedPost('Comments main post');
const secondPostId = await approvedPost('Comments second post');

// RED: old browser INSERT grant/policy must disappear in Phase 5G.
const directInsert = await reader.client.from('comments').insert({ post_id:postId, author_id:reader.userId, body:'Direct browser comment' }).select('id');
assert.ok(directInsert.error, 'authenticated browser must not directly INSERT comments');

const root = await reader.client.rpc('create_my_comment', { p_post_id:postId, p_body:'  Bình luận gốc hợp lệ  ', p_reply_to_comment_id:null });
assert.equal(root.error, null, `root comment must succeed: ${root.error?.message ?? ''}`);
assert.equal(sqlValue(`select body from public.comments where id='${root.data.id}'::uuid;`), 'Bình luận gốc hợp lệ', 'server must trim body');

const reply = await owner.client.rpc('create_my_comment', { p_post_id:postId, p_body:'Phản hồi hợp lệ', p_reply_to_comment_id:root.data.id });
assert.equal(reply.error, null);
assert.equal(reply.data.parentId, root.data.id);

const replyToReply = await reader.client.rpc('create_my_comment', { p_post_id:postId, p_body:'Phản hồi vào phản hồi', p_reply_to_comment_id:reply.data.id });
assert.equal(replyToReply.error, null);
assert.equal(replyToReply.data.parentId, root.data.id, 'third level must normalize to root');

for (const body of ['', '   ', 'x'.repeat(2001)]) {
  const invalid = await reader.client.rpc('create_my_comment', { p_post_id:postId, p_body:body, p_reply_to_comment_id:null });
  assert.ok(invalid.error, 'blank or overlong comment must fail');
}

const crossPost = await reader.client.rpc('create_my_comment', { p_post_id:secondPostId, p_body:'Sai bài', p_reply_to_comment_id:root.data.id });
assert.ok(crossPost.error, 'cross-post reply must fail');

const wrongDelete = await reader2.client.rpc('delete_my_comment', { p_comment_id:root.data.id });
assert.ok(wrongDelete.error, 'non-author cannot delete comment');

const deletedReply = await owner.client.rpc('delete_my_comment', { p_comment_id:reply.data.id });
assert.equal(deletedReply.error, null);
const replyToDeleted = await reader.client.rpc('create_my_comment', { p_post_id:postId, p_body:'Không được trả lời comment đã xóa', p_reply_to_comment_id:reply.data.id });
assert.ok(replyToDeleted.error, 'reply to deleted target must fail');

const deletedRoot = await reader.client.rpc('delete_my_comment', { p_comment_id:root.data.id });
assert.equal(deletedRoot.error, null);
assert.equal(deletedRoot.data.alreadyDeleted, false);
const deletedRootAgain = await reader.client.rpc('delete_my_comment', { p_comment_id:root.data.id });
assert.equal(deletedRootAgain.error, null);
assert.equal(deletedRootAgain.data.alreadyDeleted, true, 'self soft-delete must be idempotent');
assert.equal(sqlValue(`select count(*)::text from public.comments where id='${root.data.id}'::uuid and deleted_at is not null;`), '1', 'soft-delete must preserve row');
assert.equal(sqlValue(`select body from public.comments where id='${root.data.id}'::uuid;`), 'Bình luận gốc hợp lệ', 'soft-delete must preserve stored body for audit/moderation');

const listAfterDelete = await owner.client.rpc('list_post_comments', { p_post_id:postId });
assert.equal(listAfterDelete.error, null);
const rootView = listAfterDelete.data.items.find((item) => item.id === root.data.id);
assert.ok(rootView, 'deleted root with visible reply must remain as tombstone');
assert.equal(rootView.isDeleted, true);
assert.equal(rootView.body, null, 'ordinary projection must not reveal deleted body');
assert.equal(listAfterDelete.data.items.some((item) => item.id === replyToReply.data.id), true, 'visible reply must remain');
assert.equal(listAfterDelete.data.items.some((item) => item.id === reply.data.id), false, 'deleted reply must not be projected');

const standalone = await reader.client.rpc('create_my_comment', { p_post_id:postId, p_body:'Comment độc lập sẽ xóa', p_reply_to_comment_id:null });
assert.equal(standalone.error, null);
assert.equal((await reader.client.rpc('delete_my_comment', { p_comment_id:standalone.data.id })).error, null);
const listStandalone = await owner.client.rpc('list_post_comments', { p_post_id:postId });
assert.equal(listStandalone.data.items.some((item) => item.id === standalone.data.id), false, 'deleted root without replies may disappear');

const privacyComment = await reader2.client.rpc('create_my_comment', { p_post_id:postId, p_body:'Kiểm tra privacy danh tính', p_reply_to_comment_id:null });
assert.equal(privacyComment.error, null);
sqlExec(`update public.profiles set show_name=false,show_class=false where user_id='${reader2.userId}'::uuid;`);
const masked = await owner.client.rpc('list_post_comments', { p_post_id:postId });
const maskedView = masked.data.items.find((item) => item.id === privacyComment.data.id);
assert.equal(maskedView.authorName, 'Học sinh EDU SHARE+');
assert.equal(maskedView.authorClassName, null);
assert.equal(maskedView.canDelete, false);

const selfView = await reader2.client.rpc('list_post_comments', { p_post_id:postId });
assert.equal(selfView.data.items.find((item) => item.id === privacyComment.data.id).canDelete, true);

const rawStudentRead = await reader.client.from('comments').select('id,body').eq('post_id', postId);
assert.equal(rawStudentRead.error, null);
assert.deepEqual(rawStudentRead.data, [], 'ordinary Student must not receive raw comment rows');

const directUpdate = await reader.client.from('comments').update({ body:'Browser edit forbidden' }).eq('id', privacyComment.data.id);
assert.ok(directUpdate.error, 'authenticated browser must not directly UPDATE comments');
const directDelete = await reader.client.from('comments').delete().eq('id', privacyComment.data.id);
assert.ok(directDelete.error, 'authenticated browser must not directly DELETE comments');
assert.equal(sqlValue("select count(*)::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('edit_my_comment','update_my_comment');"), '0', 'Phase 5G must expose no comment edit RPC');

const pendingCreate = await pending.client.rpc('create_my_comment', { p_post_id:postId, p_body:'Pending bị chặn', p_reply_to_comment_id:null });
assert.ok(pendingCreate.error);
const teacherCreate = await teacher.client.rpc('create_my_comment', { p_post_id:postId, p_body:'Teacher không dùng Student comment RPC', p_reply_to_comment_id:null });
assert.ok(teacherCreate.error);

for (const [label, stateSql] of [
  ['comments-disabled', "comments_enabled=false,lifecycle_status='active',moderation_status='approved',is_hidden=false,completed_at=null,withdrawn_at=null"],
  ['hidden', "comments_enabled=true,lifecycle_status='active',moderation_status='approved',is_hidden=true,completed_at=null,withdrawn_at=null"],
  ['completed', "comments_enabled=true,lifecycle_status='completed',moderation_status='approved',is_hidden=false,completed_at=now(),withdrawn_at=null"],
  ['rejected', "comments_enabled=true,lifecycle_status='active',moderation_status='rejected',is_hidden=false,completed_at=null,withdrawn_at=null"],
]) {
  sqlExec(`update public.posts set ${stateSql} where id='${postId}'::uuid;`);
  const denied = await reader.client.rpc('create_my_comment', { p_post_id:postId, p_body:`Bị chặn ${label}`, p_reply_to_comment_id:null });
  assert.ok(denied.error, `${label} post must reject comment creation`);
}

console.log('Phase 5G comments backend matrix passed');
