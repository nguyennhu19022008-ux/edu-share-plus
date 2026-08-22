export type MediaPurpose = 'post_media' | 'avatar';

export type ReservedMedia = {
  id:string;
  bucket:string;
  path:string;
  purpose:MediaPurpose;
  mimeType:string;
  sizeBytes:number;
};

export type SignedMedia = {
  fileId:string;
  bucket:string;
  path:string;
  altText:string | null;
  sortOrder:number;
  isPrimary:boolean;
  signedUrl:string;
};

export const POST_MEDIA_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_MAX_BYTES = 3 * 1024 * 1024;
export const POST_MEDIA_MAX_FILES = 5;

const STORED_IMAGE_EXTENSIONS = Object.freeze({
  'image/jpeg':'jpg',
  'image/png':'png',
  'image/webp':'webp',
} as const);

export type StoredImageMime = keyof typeof STORED_IMAGE_EXTENSIONS;
export type StoredImageExtension = (typeof STORED_IMAGE_EXTENSIONS)[StoredImageMime];

export type MediaFileLike = {
  name:string;
  type:string;
  size:number;
};

function supportedMime(type:string):type is StoredImageMime {
  return Object.prototype.hasOwnProperty.call(STORED_IMAGE_EXTENSIONS, type);
}

function validateImageFile(
  file:MediaFileLike,
  maxBytes:number,
  maxLabel:string,
):string | null {
  if (!supportedMime(file.type)) {
    return 'Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP. Hãy chuyển đổi HEIC/HEIF hoặc định dạng khác trước khi tải lên.';
  }

  if (!Number.isSafeInteger(file.size) || file.size <= 0) {
    return 'Tệp ảnh không hợp lệ hoặc có kích thước bằng 0.';
  }

  if (file.size > maxBytes) {
    return `Ảnh vượt quá giới hạn ${maxLabel}.`;
  }

  return null;
}

export function validatePostMediaFiles(
  files:readonly MediaFileLike[],
  existingCount = 0,
):string | null {
  const safeExistingCount = Number.isSafeInteger(existingCount) && existingCount >= 0
    ? existingCount
    : 0;

  if (safeExistingCount + files.length > POST_MEDIA_MAX_FILES) {
    return 'Mỗi bài đăng được gắn tối đa 5 ảnh.';
  }

  for (const file of files) {
    const error = validateImageFile(file, POST_MEDIA_MAX_BYTES, '5 MiB');
    if (error) return `${file.name}: ${error}`;
  }

  return null;
}

export function validateAvatarFile(file:MediaFileLike):string | null {
  return validateImageFile(file, AVATAR_MAX_BYTES, '3 MiB');
}

export function extensionForMime(mime:string):StoredImageExtension {
  if (!supportedMime(mime)) {
    throw new Error('MEDIA_MIME_UNSUPPORTED');
  }
  return STORED_IMAGE_EXTENSIONS[mime];
}
