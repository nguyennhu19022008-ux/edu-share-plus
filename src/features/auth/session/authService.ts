import type { Session } from '@supabase/supabase-js';
import { getSupabaseClient } from '../../../lib/supabase/client';
import type { StudentSessionProfile } from './types';

export type StudentLoginInput = {
  email: string;
  password: string;
};

type StudentContextRpc = {
  user_id: string;
  full_name: string;
  account_status: StudentSessionProfile['accountStatus'];
  school_id: string;
  school_name: string | null;
  class_id: string | null;
};

function normalizeLoginError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes('email not confirmed')) {
    return 'Email chưa được xác minh. Hãy mở email xác nhận đã được EDU SHARE+ gửi trước khi đăng nhập.';
  }

  if (normalized.includes('invalid login credentials')) {
    return 'Email hoặc mật khẩu không đúng.';
  }

  if (
    normalized.includes('too many requests')
    || normalized.includes('rate limit')
  ) {
    return 'Có quá nhiều lần thử đăng nhập. Vui lòng đợi một lúc rồi thử lại.';
  }

  return message || 'Không thể đăng nhập lúc này. Vui lòng thử lại.';
}

function normalizeStudentContextError(message: string) {
  if (message.includes('EDU_SHARE_STUDENT_ROLE_REQUIRED')) {
    return 'Tài khoản này không phải tài khoản học sinh. Vui lòng sử dụng cổng đăng nhập phù hợp.';
  }

  if (message.includes('EDU_SHARE_STUDENT_PROFILE_NOT_FOUND')) {
    return 'Không tìm thấy hồ sơ học sinh tương ứng với tài khoản Auth.';
  }

  if (message.includes('EDU_SHARE_AUTH_REQUIRED')) {
    return 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.';
  }

  return message;
}

export async function signInStudent(
  input: StudentLoginInput,
): Promise<Session> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });

  if (error) {
    throw new Error(normalizeLoginError(error.message));
  }

  if (!data.session || !data.user) {
    throw new Error(
      'Không nhận được phiên đăng nhập hợp lệ từ hệ thống Authentication.',
    );
  }

  return data.session;
}

export async function getStudentSessionProfile(
  expectedUserId: string,
): Promise<StudentSessionProfile> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc('get_current_student_context');

  if (error) {
    throw new Error(normalizeStudentContextError(error.message));
  }

  if (!data || typeof data !== 'object') {
    throw new Error(
      'Không nhận được ngữ cảnh học sinh hợp lệ từ hệ thống phân quyền.',
    );
  }

  const context = data as StudentContextRpc;

  if (!context.user_id || context.user_id !== expectedUserId) {
    throw new Error(
      'Ngữ cảnh học sinh không khớp với phiên Authentication hiện tại.',
    );
  }

  return {
    userId: context.user_id,
    fullName: context.full_name ?? '',
    accountStatus: context.account_status,
    schoolId: context.school_id,
    classId: context.class_id ?? null,
  };
}

export async function signOutStudent(): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase.auth.signOut({ scope: 'local' });

  if (error) throw error;
}
