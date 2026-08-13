import type { Session } from '@supabase/supabase-js';
import { getSupabaseClient } from '../../../lib/supabase/client';
import type { StudentSessionProfile } from './types';

export type StudentLoginInput = {
  email: string;
  password: string;
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
  userId: string,
): Promise<StudentSessionProfile> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, full_name, account_status, school_id, class_id')
    .eq('user_id', userId)
    .single();

  if (error) throw error;

  if (!data) {
    throw new Error(
      'Không tìm thấy hồ sơ học sinh tương ứng với tài khoản Auth.',
    );
  }

  return {
    userId: String(data.user_id),
    fullName: String(data.full_name ?? ''),
    accountStatus:
      data.account_status as StudentSessionProfile['accountStatus'],
    schoolId: String(data.school_id),
    classId: data.class_id ? String(data.class_id) : null,
  };
}

export async function signOutStudent(): Promise<void> {
  const supabase = getSupabaseClient();

  // Chỉ đăng xuất session trên thiết bị/trình duyệt hiện tại.
  // Không vô tình đăng xuất các thiết bị khác của cùng tài khoản.
  const { error } = await supabase.auth.signOut({ scope: 'local' });

  if (error) throw error;
}
