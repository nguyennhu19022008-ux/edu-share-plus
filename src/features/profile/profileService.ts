import { getSupabaseClient } from '../../lib/supabase/client';
import {
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
    normalized.includes('current password')
    && (
      normalized.includes('invalid')
      || normalized.includes('incorrect')
      || normalized.includes('wrong')
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

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(
      'full_name,class_id,avatar_file_id,show_name,show_class,reputation_score_cache,reputation_label_cache,created_at,updated_at',
    )
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileError) throw profileReadError(profileError.message);
  if (!profile) {
    throw new Error('Không tìm thấy hồ sơ học sinh của tài khoản hiện tại.');
  }

  const { data: privateProfile, error: privateProfileError } = await supabase
    .from('profile_private')
    .select('contact_email,phone,show_email,show_phone,face_file_id,updated_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (privateProfileError) throw profileReadError(privateProfileError.message);
  if (!privateProfile) {
    throw new Error('Không tìm thấy thông tin riêng tư của tài khoản hiện tại.');
  }

  let classLabel: string | null = null;
  if (profile.class_id) {
    const { data: schoolClass, error: classError } = await supabase
      .from('school_classes')
      .select('label')
      .eq('id', profile.class_id)
      .maybeSingle();

    if (classError) throw profileReadError(classError.message);
    classLabel = typeof schoolClass?.label === 'string' ? schoolClass.label : null;
  }

  try {
    return parseStudentProfileView({
      authUser:user,
      profile,
      privateProfile,
      classLabel,
    });
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
  const { error } = await supabase.auth.updateUser({
    password:input.newPassword,
    current_password:input.currentPassword,
  });

  if (error) throw passwordChangeError(error.message);
}
