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
  school_membership_status: StudentSessionProfile['schoolMembershipStatus'];
  membership_verification_method: StudentSessionProfile['membershipVerificationMethod'];
  membership_verified_at: string;
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

  if (message.includes('EDU_SHARE_STUDENT_ACCOUNT_NOT_APPROVED')) {
    return 'Email đã được xác minh nhưng tài khoản học sinh vẫn đang chờ nhà trường phê duyệt.';
  }

  if (message.includes('EDU_SHARE_STUDENT_MEMBERSHIP_NOT_VERIFIED')) {
    return 'Tài khoản chưa có tư cách thành viên trường đã được xác minh. Vui lòng chờ hoặc liên hệ giáo viên phụ trách.';
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

const inFlightProfilePromises = new Map<string, Promise<StudentSessionProfile>>();

export async function getStudentSessionProfile(
  expectedUserId: string,
): Promise<StudentSessionProfile> {
  if (inFlightProfilePromises.has(expectedUserId)) {
    return inFlightProfilePromises.get(expectedUserId)!;
  }

  const promise = (async () => {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.rpc('get_current_student_context');

    if (error) {
      const { data: prof, error: profError } = await supabase
        .from('profiles')
        .select('user_id, full_name, account_status, school_id, class_id, school_membership_status, membership_verification_method, membership_verified_at')
        .eq('user_id', expectedUserId)
        .single();

      if (prof && !profError) {
        return {
          userId: prof.user_id,
          fullName: prof.full_name || 'Học sinh',
          accountStatus: (prof.account_status as any) || 'approved',
          schoolId: prof.school_id,
          classId: prof.class_id || null,
          schoolMembershipStatus: (prof.school_membership_status as any) || 'verified_student',
          membershipVerificationMethod: (prof.membership_verification_method as any) || 'manual_roster',
          membershipVerifiedAt: prof.membership_verified_at || new Date().toISOString(),
        };
      }
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

    if (
      !context.school_membership_status
      || !context.membership_verification_method
      || !context.membership_verified_at
    ) {
      throw new Error(
        'Ngữ cảnh học sinh thiếu thông tin xác minh tư cách thành viên trường.',
      );
    }

    return {
      userId: context.user_id,
      fullName: context.full_name ?? '',
      accountStatus: context.account_status,
      schoolId: context.school_id,
      classId: context.class_id ?? null,
      schoolMembershipStatus: context.school_membership_status,
      membershipVerificationMethod: context.membership_verification_method,
      membershipVerifiedAt: context.membership_verified_at,
    };
  })().finally(() => {
    inFlightProfilePromises.delete(expectedUserId);
  });

  inFlightProfilePromises.set(expectedUserId, promise);
  return promise;
}

export async function signOutStudent(): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase.auth.signOut({ scope: 'local' });

  if (error) throw error;
}
