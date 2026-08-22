import { getSupabaseClient } from '../../lib/supabase/client';
import {
  validateAvatarFile,
  validatePostMediaFiles,
  type MediaPurpose,
  type ReservedMedia,
  type SignedMedia,
} from './mediaModel';

const SIGNED_URL_SECONDS = 300;

type JsonRecord = Record<string, unknown>;

function isRecord(value:unknown):value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(value:unknown):string {
  if (typeof value !== 'string' || !value) throw new Error('MEDIA_RESPONSE_INVALID');
  return value;
}

function parseReservation(raw:unknown):ReservedMedia {
  if (!isRecord(raw)) throw new Error('MEDIA_RESPONSE_INVALID');
  const purpose = raw.purpose;
  if (purpose !== 'post_media' && purpose !== 'avatar') throw new Error('MEDIA_RESPONSE_INVALID');
  if (typeof raw.sizeBytes !== 'number' || !Number.isSafeInteger(raw.sizeBytes) || raw.sizeBytes <= 0) {
    throw new Error('MEDIA_RESPONSE_INVALID');
  }
  return {
    id:requireString(raw.id),
    bucket:requireString(raw.bucket),
    path:requireString(raw.path),
    purpose,
    mimeType:requireString(raw.mimeType),
    sizeBytes:raw.sizeBytes,
  };
}

function safeUploadError():Error {
  return new Error('Không thể tải tệp lên lúc này. Vui lòng thử lại.');
}

function safeReadError():Error {
  return new Error('Không thể tải media lúc này. Vui lòng thử lại.');
}

async function tombstoneRemovedFile(fileId:string):Promise<boolean> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('mark_my_file_deleted', { p_file_id:fileId });
  return !error;
}

async function cleanupUnboundObject(media:Pick<ReservedMedia, 'id' | 'bucket' | 'path'>):Promise<boolean> {
  const supabase = getSupabaseClient();
  const { error:removeError } = await supabase.storage.from(media.bucket).remove([media.path]);
  if (removeError) return false;
  return tombstoneRemovedFile(media.id);
}

async function reserveUploadFinalize(
  purpose:MediaPurpose,
  file:File,
  postId:string | null,
):Promise<ReservedMedia> {
  const supabase = getSupabaseClient();
  const { data:reservedRaw, error:reserveError } = await supabase.rpc('reserve_my_file', {
    p_purpose:purpose,
    p_mime_type:file.type,
    p_size_bytes:file.size,
    p_post_id:purpose === 'post_media' ? postId : null,
  });
  if (reserveError) throw safeUploadError();

  let reserved:ReservedMedia;
  try {
    reserved = parseReservation(reservedRaw);
  } catch {
    throw safeUploadError();
  }

  const bucket = supabase.storage.from(reserved.bucket);
  const { error:uploadError } = await bucket.upload(reserved.path, file, {
    upsert:false,
    contentType:file.type,
  });
  if (uploadError) {
    await cleanupUnboundObject(reserved);
    throw safeUploadError();
  }

  const { error:finalizeError } = await supabase.rpc('finalize_my_file', { p_file_id:reserved.id });
  if (finalizeError) {
    await cleanupUnboundObject(reserved);
    throw safeUploadError();
  }

  return reserved;
}

async function createPrivateSignedUrl(bucketName:string, path:string):Promise<string> {
  const supabase = getSupabaseClient();
  const bucket = supabase.storage.from(bucketName);
  const { data, error } = await bucket.createSignedUrl(path, 300);
  if (error || !data?.signedUrl) throw safeReadError();
  return data.signedUrl;
}

export async function uploadPostMedia(
  postId:string,
  files:readonly File[],
):Promise<{ attached:SignedMedia[]; failed:Array<{ name:string; message:string }> }> {
  const id = postId.trim();
  if (!id) throw safeUploadError();

  const supabase = getSupabaseClient();
  const { count, error:countError } = await supabase
    .from('post_media')
    .select('id', { count:'exact', head:true })
    .eq('post_id', id);
  if (countError) throw safeReadError();

  const existingCount = count ?? 0;
  const validationError = validatePostMediaFiles(files, existingCount);
  if (validationError) throw new Error(validationError);

  const attached:SignedMedia[] = [];
  const failed:Array<{ name:string; message:string }> = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    try {
      const reserved = await reserveUploadFinalize('post_media', file, id);
      const sortOrder = existingCount + index;

      let signedUrl:string;
      try {
        signedUrl = await createPrivateSignedUrl(reserved.bucket, reserved.path);
      } catch (error) {
        await cleanupUnboundObject(reserved);
        throw error;
      }

      const { data:boundRaw, error:bindError } = await supabase.rpc('bind_my_post_media', {
        p_post_id:id,
        p_file_id:reserved.id,
        p_sort_order:sortOrder,
        p_is_primary:false,
        p_alt_text:null,
      });
      if (bindError || !isRecord(boundRaw) || typeof boundRaw.isPrimary !== 'boolean') {
        await cleanupUnboundObject(reserved);
        throw safeUploadError();
      }

      attached.push({
        fileId:reserved.id,
        bucket:reserved.bucket,
        path:reserved.path,
        altText:null,
        sortOrder,
        isPrimary:boundRaw.isPrimary,
        signedUrl,
      });
    } catch (error) {
      failed.push({
        name:file.name,
        message:error instanceof Error ? error.message : safeUploadError().message,
      });
    }
  }

  return { attached, failed };
}

export async function listPostMedia(postId:string):Promise<SignedMedia[]> {
  const id = postId.trim();
  if (!id) return [];
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('post_media')
    .select('file_id,sort_order,is_primary,alt_text,file:file_objects!post_media_file_fk(bucket,storage_path,binding_status,deleted_at)')
    .eq('post_id', id)
    .order('sort_order', { ascending:true });
  if (error) throw safeReadError();

  const signed:SignedMedia[] = [];
  for (const raw of data ?? []) {
    if (!isRecord(raw) || typeof raw.file_id !== 'string' || typeof raw.sort_order !== 'number' || typeof raw.is_primary !== 'boolean') {
      continue;
    }
    const file = raw.file;
    if (!isRecord(file)
      || typeof file.bucket !== 'string'
      || typeof file.storage_path !== 'string'
      || file.binding_status !== 'bound'
      || file.deleted_at !== null) {
      continue;
    }
    try {
      const signedUrl = await createPrivateSignedUrl(file.bucket, file.storage_path);
      signed.push({
        fileId:raw.file_id,
        bucket:file.bucket,
        path:file.storage_path,
        altText:typeof raw.alt_text === 'string' ? raw.alt_text : null,
        sortOrder:raw.sort_order,
        isPrimary:raw.is_primary,
        signedUrl,
      });
    } catch {
      // One inaccessible/expired object must not cause the UI to invent a URL or hide other valid media.
    }
  }
  return signed;
}

export async function removeMyPostMedia(postId:string, media:SignedMedia):Promise<void> {
  const supabase = getSupabaseClient();
  const { data:unboundRaw, error:unbindError } = await supabase.rpc('remove_my_post_media', {
    p_post_id:postId,
    p_file_id:media.fileId,
  });
  if (unbindError || !isRecord(unboundRaw)) throw new Error('Không thể gỡ ảnh khỏi bài đăng lúc này.');

  const fileId = requireString(unboundRaw.fileId);
  const bucketName = requireString(unboundRaw.bucket);
  const path = requireString(unboundRaw.path);
  const { error:removeError } = await supabase.storage.from(bucketName).remove([path]);
  if (removeError) throw new Error('Ảnh đã được gỡ khỏi bài nhưng chưa thể dọn tệp Storage. Vui lòng thử lại sau.');

  const tombstoned = await tombstoneRemovedFile(fileId);
  if (!tombstoned) {
    throw new Error('Ảnh đã được gỡ khỏi bài nhưng việc dọn tệp chưa hoàn tất. Vui lòng thử lại sau.');
  }
}

export async function uploadMyAvatar(file:File):Promise<string> {
  const validationError = validateAvatarFile(file);
  if (validationError) throw new Error(validationError);

  const supabase = getSupabaseClient();
  const reserved = await reserveUploadFinalize('avatar', file, null);

  let signedUrl:string;
  try {
    signedUrl = await createPrivateSignedUrl(reserved.bucket, reserved.path);
  } catch (error) {
    await cleanupUnboundObject(reserved);
    throw error;
  }

  const { data:boundRaw, error:bindError } = await supabase.rpc('set_my_avatar', { p_file_id:reserved.id });
  if (bindError || !isRecord(boundRaw)) {
    await cleanupUnboundObject(reserved);
    throw safeUploadError();
  }

  const previous = boundRaw.previousAvatar;
  if (isRecord(previous)
    && typeof previous.fileId === 'string'
    && typeof previous.bucket === 'string'
    && typeof previous.path === 'string') {
    await cleanupUnboundObject({ id:previous.fileId, bucket:previous.bucket, path:previous.path });
  }

  return signedUrl;
}

export async function getMyAvatarSignedUrl(avatarFileId:string | null):Promise<string> {
  const id = avatarFileId?.trim() ?? '';
  if (!id) return '';

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('file_objects')
    .select('bucket,storage_path,purpose,binding_status,deleted_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw safeReadError();
  if (!data
    || data.purpose !== 'avatar'
    || data.binding_status !== 'bound'
    || data.deleted_at !== null
    || typeof data.bucket !== 'string'
    || typeof data.storage_path !== 'string') {
    return '';
  }

  const bucket = supabase.storage.from(data.bucket);
  const { data:signed, error:signedError } = await bucket.createSignedUrl(data.storage_path, SIGNED_URL_SECONDS);
  if (signedError || !signed?.signedUrl) throw safeReadError();
  return signed.signedUrl;
}
