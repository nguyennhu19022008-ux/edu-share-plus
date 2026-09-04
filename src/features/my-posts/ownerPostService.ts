import { getSupabaseClient } from '../../lib/supabase/client';
import {
  buildOwnerPostMutationArgs,
  parseOwnerPostRow,
  parseOwnerWriteResponse,
  type OwnerContactMethod,
  type OwnerPostCreateInput,
  type OwnerPostDetail,
  type OwnerPostHistoryItem,
  type OwnerPostListQuery,
  type OwnerPostListResult,
  type OwnerPostView,
  type OwnerVisibilityScope,
  type OwnerWriteResponse,
} from './ownerPostModel';

const OWNER_POST_SELECT = [
  'id','title','description','trade_type','sale_price','moderation_status','lifecycle_status',
  'visibility_scope','preferred_contact_method','original_purchase_price','original_price_is_estimate',
  'purchase_date','condition_grade','brand','model','is_hidden','comments_enabled','created_at','updated_at',
  'published_at','completed_at','withdrawn_at',
  'category:categories!posts_category_fk(id,name)',
  'class:school_classes!posts_class_scope_fk(id,label)',
].join(',');

export type OwnerPostReferenceOptions = {
  categories:Array<{ id:string; name:string }>;
  currentClassId:string | null;
  currentClassName:string | null;
  schoolMarketplaceScope:'school' | 'network';
  visibilityScopes:OwnerVisibilityScope[];
  contactMethods:OwnerContactMethod[];
};

function safeReadError():Error {
  return new Error('Không thể tải bài đăng của bạn lúc này. Vui lòng thử lại.');
}

function safeWriteError():Error {
  return new Error('Không thể lưu thay đổi bài đăng lúc này. Vui lòng thử lại.');
}

async function requireCurrentUser() {
  const supabase = getSupabaseClient();
  const { data: sessionData } = await supabase.auth.getSession();
  let user = sessionData.session?.user;

  if (!user) {
    const { data: userData, error } = await supabase.auth.getUser();
    if (error || !userData.user) throw safeReadError();
    user = userData.user;
  }

  return { supabase, user };
}

export type OwnerSummaryCounts = {
  total:number;
  active:number;
  completed:number;
  needsAction:number;
  pending:number;
  rejected:number;
  withdrawn:number;
};

export async function getMyPostSummaryCounts():Promise<OwnerSummaryCounts> {
  const { supabase, user } = await requireCurrentUser();
  const { data, error } = await supabase
    .from('posts')
    .select('moderation_status,lifecycle_status')
    .eq('owner_id', user.id);

  if (error || !data) {
    return { total:0, active:0, completed:0, needsAction:0, pending:0, rejected:0, withdrawn:0 };
  }

  let active = 0;
  let completed = 0;
  let pending = 0;
  let rejected = 0;
  let withdrawn = 0;

  for (const row of data as Array<{ moderation_status?:string; lifecycle_status?:string }>) {
    if (row.lifecycle_status === 'completed') {
      completed++;
    } else if (row.lifecycle_status === 'withdrawn') {
      withdrawn++;
    } else if (row.moderation_status === 'pending') {
      pending++;
    } else if (row.moderation_status === 'rejected') {
      rejected++;
    } else if (row.lifecycle_status === 'active' && row.moderation_status === 'approved') {
      active++;
    }
  }

  return {
    total:data.length,
    active,
    completed,
    needsAction:pending + rejected,
    pending,
    rejected,
    withdrawn,
  };
}

export async function listMyPosts(query:OwnerPostListQuery):Promise<OwnerPostListResult> {
  const { supabase, user } = await requireCurrentUser();
  const page = Math.max(1, Math.trunc(query.page || 1));
  const pageSize = Math.min(50, Math.max(1, Math.trunc(query.pageSize || 12)));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let request = supabase
    .from('posts')
    .select(OWNER_POST_SELECT, { count:'exact' })
    .eq('owner_id', user.id);

  if (query.moderationStatus) request = request.eq('moderation_status', query.moderationStatus);
  if (query.lifecycleStatus) request = request.eq('lifecycle_status', query.lifecycleStatus);
  const keyword = query.keyword?.trim();
  if (keyword) request = request.textSearch('search_tsv', keyword, { type:'websearch', config:'simple' });

  if (query.sort === 'oldest') {
    request = request.order('created_at', { ascending:true });
  } else if (query.sort === 'price_asc') {
    request = request.order('sale_price', { ascending:true, nullsFirst:false });
  } else if (query.sort === 'price_desc') {
    request = request.order('sale_price', { ascending:false, nullsFirst:false });
  } else {
    request = request.order('created_at', { ascending:false });
  }

  const { data, error, count } = await request.range(from, to);
  if (error) throw safeReadError();

  try {
    const items = (data ?? []).map((row) => parseOwnerPostRow(row));
    const totalCount = count ?? 0;
    return { items, totalCount, page, pageSize, totalPages:totalCount ? Math.ceil(totalCount / pageSize) : 0 };
  } catch {
    throw safeReadError();
  }
}

function parseHistoryItem(raw:unknown):OwnerPostHistoryItem {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('OWNER_POST_RESPONSE_INVALID');
  const row = raw as Record<string, unknown>;
  if (
    typeof row.id !== 'string' || typeof row.dimension !== 'string' || typeof row.new_value !== 'string'
    || typeof row.created_at !== 'string' || !Number.isFinite(Date.parse(row.created_at))
  ) throw new Error('OWNER_POST_RESPONSE_INVALID');
  return {
    id:row.id,
    dimension:row.dimension,
    oldValue:typeof row.old_value === 'string' ? row.old_value : null,
    newValue:row.new_value,
    reason:typeof row.reason === 'string' ? row.reason : null,
    createdAt:row.created_at,
  };
}

export async function getMyPost(postId:string):Promise<OwnerPostDetail | null> {
  const id = postId.trim();
  if (!id) return null;
  const { supabase, user } = await requireCurrentUser();
  const { data:postRow, error:postError } = await supabase
    .from('posts')
    .select(OWNER_POST_SELECT)
    .eq('owner_id', user.id)
    .eq('id', id)
    .maybeSingle();
  if (postError) throw safeReadError();
  if (!postRow) return null;

  const { data:historyRows, error:historyError } = await supabase
    .from('post_status_history')
    .select('id,dimension,old_value,new_value,reason,created_at')
    .eq('post_id', id)
    .order('created_at', { ascending:false })
    .limit(50);
  if (historyError) throw safeReadError();

  try {
    const post = parseOwnerPostRow(postRow);
    const history = (historyRows ?? []).map(parseHistoryItem);
    const rejectionReason = history.find((item) => item.dimension === 'moderation' && item.newValue === 'rejected' && item.reason)?.reason ?? null;
    return { post, rejectionReason, history };
  } catch {
    throw safeReadError();
  }
}

export async function loadOwnerPostReferenceOptions():Promise<OwnerPostReferenceOptions> {
  const { supabase, user } = await requireCurrentUser();
  const { data:context, error:contextError } = await supabase.rpc('get_current_student_context');
  if (contextError || !context || typeof context !== 'object' || Array.isArray(context)) throw safeReadError();
  const contextRow = context as Record<string, unknown>;
  const schoolId = typeof contextRow.school_id === 'string' ? contextRow.school_id : '';
  const currentClassId = typeof contextRow.class_id === 'string' ? contextRow.class_id : null;
  if (!schoolId) throw safeReadError();

  const categoriesResult = await supabase.from('categories').select('id,name').eq('is_active', true).order('sort_order', { ascending:true });
  const schoolResult = await supabase.from('schools').select('marketplace_scope').eq('id', schoolId).maybeSingle();
  const privateResult = await supabase.from('profile_private').select('contact_email,phone').eq('user_id', user.id).maybeSingle();
  const classResult = currentClassId
    ? await supabase.from('school_classes').select('label').eq('id', currentClassId).maybeSingle()
    : { data:null, error:null };

  if (categoriesResult.error || schoolResult.error || privateResult.error || classResult.error) throw safeReadError();
  const schoolScope = schoolResult.data?.marketplace_scope;
  if (schoolScope !== 'school' && schoolScope !== 'network') throw safeReadError();

  const categories = (categoriesResult.data ?? []).flatMap((row) => (
    typeof row.id === 'string' && typeof row.name === 'string' ? [{ id:row.id, name:row.name }] : []
  ));
  const contactMethods:OwnerContactMethod[] = [];
  if (typeof privateResult.data?.contact_email === 'string' && privateResult.data.contact_email.trim()) contactMethods.push('email');
  if (typeof privateResult.data?.phone === 'string' && privateResult.data.phone.trim()) contactMethods.push('phone');

  return {
    categories,
    currentClassId,
    currentClassName:typeof classResult.data?.label === 'string' ? classResult.data.label : null,
    schoolMarketplaceScope:schoolScope,
    visibilityScopes:schoolScope === 'network' ? ['inherit','school','network'] : ['inherit','school'],
    contactMethods,
  };
}

export async function createMyPost(input:OwnerPostCreateInput):Promise<OwnerWriteResponse> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('create_my_post', buildOwnerPostMutationArgs(input));
  if (error) throw safeWriteError();
  return parseOwnerWriteResponse(data);
}

export async function updateMyPost(postId:string, input:OwnerPostCreateInput):Promise<OwnerWriteResponse> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('update_my_post', { p_post_id:postId, ...buildOwnerPostMutationArgs(input) });
  if (error) throw safeWriteError();
  return parseOwnerWriteResponse(data);
}

export async function changeMyPostLifecycle(postId:string, action:'complete' | 'withdraw'):Promise<OwnerWriteResponse> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('change_my_post_lifecycle', { p_post_id:postId, p_action:action });
  if (error) throw safeWriteError();
  return parseOwnerWriteResponse(data);
}

export function canEditOwnerPost(post:OwnerPostView):boolean {
  return post.lifecycleStatus === 'active';
}
