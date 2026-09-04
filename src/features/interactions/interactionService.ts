import { getSupabaseClient } from '../../lib/supabase/client';
import {
  parseCommentDeleteResponse,
  parseCommentListResponse,
  parseCommentMutationResponse,
  parseContactRevealResponse,
  parseOwnerContactHistoryResponse,
  parseSavedPostListResponse,
  type CommentDeleteResult,
  type CommentMutationResult,
  type CommentView,
  type ContactRevealView,
  type OwnerContactHistory,
  type SavedPostList,
} from './interactionModel';

type BackendError = {
  message?:string;
  code?:string;
};

function requiredId(value:string, code:string):string {
  const normalized = value.trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

function interactionReadError():Error {
  return new Error('Không thể tải dữ liệu tương tác lúc này. Vui lòng thử lại.');
}

function favoriteError():Error {
  return new Error('Không thể cập nhật bài đã lưu lúc này. Vui lòng thử lại.');
}

function commentError(error:BackendError | null):Error {
  const message = error?.message ?? '';
  if (message.includes('EDU_SHARE_COMMENTS_DISABLED')) {
    return new Error('Bài đăng hiện đã tắt bình luận.');
  }
  if (message.includes('EDU_SHARE_COMMENT_BODY_INVALID')) {
    return new Error('Bình luận phải có từ 1 đến 2000 ký tự.');
  }
  if (
    message.includes('EDU_SHARE_MARKETPLACE_ACCESS_DENIED')
    || message.includes('EDU_SHARE_MARKETPLACE_POST_NOT_FOUND')
  ) {
    return new Error('Bạn hiện không thể bình luận trên bài đăng này.');
  }
  if (message.includes('EDU_SHARE_COMMENT_DELETE_FORBIDDEN')) {
    return new Error('Bạn chỉ có thể xóa bình luận của chính mình.');
  }
  return new Error('Không thể cập nhật bình luận lúc này. Vui lòng thử lại.');
}

function contactError(error:BackendError | null):Error {
  const message = error?.message ?? '';
  if (message.includes('EDU_SHARE_CONTACT_METHOD_CHANGED_DURING_DEDUPE')) {
    return new Error('Chủ bài vừa đổi kênh liên hệ. Vui lòng thử lại sau ít phút để hệ thống tạo bản ghi truy cập mới.');
  }
  if (message.includes('EDU_SHARE_CONTACT_PRIVACY_DISABLED')) {
    return new Error('Chủ bài hiện không cho phép hiển thị kênh liên hệ đã chọn.');
  }
  if (message.includes('EDU_SHARE_CONTACT_VALUE_UNAVAILABLE')) {
    return new Error('Kênh liên hệ đã chọn hiện không khả dụng.');
  }
  if (message.includes('EDU_SHARE_CONTACT_SELF_REVEAL_FORBIDDEN')) {
    return new Error('Bạn không cần dùng luồng xem liên hệ cho bài đăng của chính mình.');
  }
  if (
    message.includes('EDU_SHARE_MARKETPLACE_ACCESS_DENIED')
    || message.includes('EDU_SHARE_MARKETPLACE_POST_NOT_FOUND')
  ) {
    return new Error('Bạn hiện không thể xem thông tin liên hệ của bài đăng này.');
  }
  return new Error('Không thể xem thông tin liên hệ lúc này. Vui lòng thử lại.');
}

function parseSafely<T>(parse:() => T, fallback:() => Error):T {
  try {
    return parse();
  } catch (error) {
    if (error instanceof Error && error.message === 'INTERACTION_RESPONSE_INVALID') {
      throw fallback();
    }
    throw error;
  }
}

export async function setPostSaved(postId:string, saved:boolean):Promise<void> {
  const normalizedId = requiredId(postId, 'INTERACTION_POST_ID_REQUIRED');
  const supabase = getSupabaseClient();
  const { data: sessionData } = await supabase.auth.getSession();
  let user = sessionData.session?.user;

  if (!user) {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) throw favoriteError();
    user = userData.user;
  }

  if (saved) {
    const { error } = await supabase
      .from('favorites')
      .insert({ user_id:user.id, post_id:normalizedId });
    if (error && error.code === '23505') return;
    if (error) throw favoriteError();
    return;
  }

  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('user_id', user.id)
    .eq('post_id', normalizedId);
  if (error) throw favoriteError();
}

export async function listMySavedPosts(limit=20, offset=0):Promise<SavedPostList> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('list_my_saved_posts', {
    p_limit:limit,
    p_offset:offset,
  });
  if (error) throw interactionReadError();
  return parseSafely(() => parseSavedPostListResponse(data), interactionReadError);
}

export async function listPostComments(postId:string):Promise<CommentView[]> {
  const normalizedId = requiredId(postId, 'INTERACTION_POST_ID_REQUIRED');
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('list_post_comments', {
    p_post_id:normalizedId,
  });
  if (error) throw interactionReadError();
  return parseSafely(() => parseCommentListResponse(data), interactionReadError);
}

export async function createMyComment(
  postId:string,
  body:string,
  replyToCommentId:string | null = null,
):Promise<CommentMutationResult> {
  const normalizedId = requiredId(postId, 'INTERACTION_POST_ID_REQUIRED');
  const normalizedReplyId = replyToCommentId === null
    ? null
    : requiredId(replyToCommentId, 'INTERACTION_COMMENT_ID_REQUIRED');
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('create_my_comment', {
    p_post_id:normalizedId,
    p_body:body,
    p_reply_to_comment_id:normalizedReplyId,
  });
  if (error) throw commentError(error);
  return parseSafely(() => parseCommentMutationResponse(data), () => commentError(null));
}

export async function deleteMyComment(commentId:string):Promise<CommentDeleteResult> {
  const normalizedId = requiredId(commentId, 'INTERACTION_COMMENT_ID_REQUIRED');
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('delete_my_comment', {
    p_comment_id:normalizedId,
  });
  if (error) throw commentError(error);
  return parseSafely(() => parseCommentDeleteResponse(data), () => commentError(null));
}

export async function revealPostContact(postId:string):Promise<ContactRevealView> {
  const normalizedId = requiredId(postId, 'INTERACTION_POST_ID_REQUIRED');
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('reveal_post_contact', {
    p_post_id:normalizedId,
  });
  if (error) throw contactError(error);
  return parseSafely(() => parseContactRevealResponse(data), () => contactError(null));
}

export async function listMyPostContactEvents(
  postId:string,
  limit=20,
):Promise<OwnerContactHistory> {
  const normalizedId = requiredId(postId, 'INTERACTION_POST_ID_REQUIRED');
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('list_my_post_contact_events', {
    p_post_id:normalizedId,
    p_limit:limit,
  });
  if (error) throw interactionReadError();
  return parseSafely(() => parseOwnerContactHistoryResponse(data), interactionReadError);
}
