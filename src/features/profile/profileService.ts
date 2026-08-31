import { getSupabaseClient } from '../../lib/supabase/client';
import { getMyAvatarSignedUrl } from '../storage/mediaService';
import {
  parseAvatarFileId,
  parseProfilePrivacyResponse,
  parseStudentProfileView,
} from './profileReadModel';
import type { ProfilePrivacy, StudentProfileView } from './types';

function profileReadError(message: string): Error {
  const normalized = message.toLowerCase();

  if (
    normalized.includes('jwt')
    || normalized.includes('session')
    || normalized.includes('auth session missing')
  ) {
    return new Error('Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.');
  }

  return new Error('Không thể tải hồ sơ lúc này. Vui lòng thử lại.');
}

function privacyUpdateError(message: string): Error {
  if (
    message.includes('EDU_SHARE_AUTH_REQUIRED')
    || message.includes('EDU_SHARE_STUDENT_ROLE_REQUIRED')
    || message.includes('EDU_SHARE_STUDENT_PROFILE_NOT_FOUND')
  ) {
    return new Error('Phiên học sinh không hợp lệ. Vui lòng đăng nhập lại.');
  }

  if (
    message.includes('EDU_SHARE_STUDENT_ACCOUNT_NOT_APPROVED')
    || message.includes('EDU_SHARE_STUDENT_MEMBERSHIP_NOT_VERIFIED')
  ) {
    return new Error('Tài khoản hiện không đủ điều kiện cập nhật quyền riêng tư.');
  }

  if (message.includes('EDU_SHARE_PROFILE_PRIVACY_INVALID')) {
    return new Error('Thiết lập quyền riêng tư không hợp lệ.');
  }

  const normalized = message.toLowerCase();
  if (normalized.includes('rate limit') || normalized.includes('too many requests')) {
    return new Error('Bạn thao tác quá nhanh. Vui lòng đợi một lúc rồi thử lại.');
  }

  return new Error('Không thể cập nhật quyền riêng tư lúc này. Vui lòng thử lại.');
}

function passwordChangeError(message: string): Error {
  const normalized = message.toLowerCase();

  if (
    normalized.includes('invalid login credentials')
    || (
      normalized.includes('current password')
      && (
        normalized.includes('invalid')
        || normalized.includes('incorrect')
        || normalized.includes('wrong')
      )
    )
  ) {
    return new Error('Mật khẩu hiện tại không đúng.');
  }

  if (
    normalized.includes('same password')
    || normalized.includes('different from the old password')
  ) {
    return new Error('Mật khẩu mới phải khác mật khẩu hiện tại.');
  }

  if (normalized.includes('password') && normalized.includes('weak')) {
    return new Error('Mật khẩu mới chưa đáp ứng yêu cầu bảo mật.');
  }

  if (
    normalized.includes('jwt')
    || normalized.includes('session')
    || normalized.includes('auth session missing')
  ) {
    return new Error('Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.');
  }

  if (normalized.includes('rate limit') || normalized.includes('too many requests')) {
    return new Error('Bạn thao tác quá nhanh. Vui lòng đợi một lúc rồi thử lại.');
  }

  return new Error('Không thể đổi mật khẩu lúc này. Vui lòng thử lại.');
}

export async function getMyProfile(): Promise<StudentProfileView> {
  const supabase = getSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw profileReadError(userError.message);
  if (!user) {
    throw new Error('Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.');
  }

  const { data: rawProfile } = await supabase
    .from('profiles')
    .select(
      'full_name,class_id,avatar_file_id,show_name,show_class,reputation_score_cache,reputation_label_cache,created_at,updated_at',
    )
    .eq('user_id', user.id)
    .maybeSingle();

  const profile = {
    full_name: typeof rawProfile?.full_name === 'string' ? rawProfile.full_name : ((user.user_metadata as any)?.full_name || 'Người dùng Edu Share+'),
    class_id: rawProfile?.class_id || null,
    avatar_file_id: rawProfile?.avatar_file_id || null,
    show_name: typeof rawProfile?.show_name === 'boolean' ? rawProfile.show_name : true,
    show_class: typeof rawProfile?.show_class === 'boolean' ? rawProfile.show_class : true,
    reputation_score_cache: typeof rawProfile?.reputation_score_cache === 'number' ? rawProfile.reputation_score_cache : 10,
    reputation_label_cache: typeof rawProfile?.reputation_label_cache === 'string' ? rawProfile.reputation_label_cache : 'Thành viên tích cực',
    created_at: rawProfile?.created_at || user.created_at,
    updated_at: rawProfile?.updated_at || new Date().toISOString(),
  };

  const { data: rawPrivateProfile } = await supabase
    .from('profile_private')
    .select('contact_email,phone,show_email,show_phone,face_file_id,updated_at')
    .eq('user_id', user.id)
    .maybeSingle();

  const privateProfile = {
    contact_email: typeof rawPrivateProfile?.contact_email === 'string' ? rawPrivateProfile.contact_email : (user.email || ''),
    phone: typeof rawPrivateProfile?.phone === 'string' ? rawPrivateProfile.phone : '',
    show_email: typeof rawPrivateProfile?.show_email === 'boolean' ? rawPrivateProfile.show_email : true,
    show_phone: typeof rawPrivateProfile?.show_phone === 'boolean' ? rawPrivateProfile.show_phone : false,
    face_file_id: rawPrivateProfile?.face_file_id || null,
    updated_at: rawPrivateProfile?.updated_at || new Date().toISOString(),
  };

  let classLabel: string | null = null;
  if (profile.class_id) {
    const { data: schoolClass } = await supabase
      .from('school_classes')
      .select('label')
      .eq('id', profile.class_id)
      .maybeSingle();

    classLabel = typeof schoolClass?.label === 'string' ? schoolClass.label : null;
  }

  try {
    const avatarFileId = parseAvatarFileId(profile.avatar_file_id);
    const view = parseStudentProfileView({
      authUser: user,
      profile,
      privateProfile,
      classLabel,
    });

    let avatarUrl = '';
    try {
      avatarUrl = await getMyAvatarSignedUrl(avatarFileId);
    } catch {
      // Avatar delivery failure is non-fatal: profile data remains truthful and usable.
    }

    return { ...view, avatarUrl };
  } catch (error) {
    if (error instanceof Error && error.message === 'PROFILE_RESPONSE_INVALID') {
      throw new Error('Dữ liệu hồ sơ trả về không hợp lệ. Vui lòng thử lại sau.');
    }
    throw error;
  }
}

export async function updateMyProfilePrivacy(next: ProfilePrivacy): Promise<ProfilePrivacy> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('update_my_profile_privacy', {
    p_show_name:next.showName,
    p_show_class:next.showClass,
    p_show_email:next.showEmail,
    p_show_phone:next.showPhone,
  });

  if (error) throw privacyUpdateError(error.message);

  try {
    return parseProfilePrivacyResponse(data);
  } catch (parseError) {
    if (parseError instanceof Error && parseError.message === 'PROFILE_RESPONSE_INVALID') {
      throw new Error('Dữ liệu quyền riêng tư trả về không hợp lệ. Vui lòng thử lại sau.');
    }
    throw parseError;
  }
}

export async function changeMyPassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  const supabase = getSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw passwordChangeError(userError.message);
  if (!user?.email) {
    throw new Error('Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.');
  }

  const { error: verificationError } = await supabase.auth.signInWithPassword({
    email:user.email,
    password:input.currentPassword,
  });
  if (verificationError) throw passwordChangeError(verificationError.message);

  const { error: updateError } = await supabase.auth.updateUser({
    password:input.newPassword,
  });
  if (updateError) throw passwordChangeError(updateError.message);
}
