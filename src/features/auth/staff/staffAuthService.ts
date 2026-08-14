import type { Session } from '@supabase/supabase-js';
import { getSupabaseClient } from '../../../lib/supabase/client';
import type {
  ExistingStaffSessionState,
  StaffContext,
  StaffRoleCode,
} from './types';

type StaffContextRpc = {
  user_id: string;
  full_name: string;
  account_status: string;
  role_code: string;
  school_id: string | null;
  school_name: string | null;
};

export type StaffLoginInput = {
  email: string;
  password: string;
};

function normalizeCredentialError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes('email not confirmed')) {
    return 'Email giáo viên chưa được xác minh.';
  }

  if (normalized.includes('invalid login credentials')) {
    return 'Email hoặc mật khẩu giáo viên không đúng.';
  }

  if (
    normalized.includes('too many requests')
    || normalized.includes('rate limit')
  ) {
    return 'Có quá nhiều lần thử đăng nhập. Vui lòng đợi một lúc rồi thử lại.';
  }

  return message || 'Không thể đăng nhập giáo viên lúc này.';
}

function normalizeStaffContextError(message: string) {
  if (message.includes('EDU_SHARE_STAFF_ACCESS_REQUIRED')) {
    return 'Tài khoản này không có quyền giáo viên hoặc quản trị viên.';
  }

  if (message.includes('EDU_SHARE_STAFF_ACCOUNT_NOT_APPROVED')) {
    return 'Tài khoản giáo viên chưa được phê duyệt để sử dụng khu vực quản trị.';
  }

  if (message.includes('EDU_SHARE_TEACHER_SCHOOL_SCOPE_MISSING')) {
    return 'Tài khoản giáo viên chưa được gán phạm vi trường học.';
  }

  if (message.includes('EDU_SHARE_STAFF_PROFILE_NOT_FOUND')) {
    return 'Không tìm thấy hồ sơ giáo viên tương ứng với tài khoản Auth.';
  }

  if (message.includes('EDU_SHARE_AUTH_REQUIRED')) {
    return 'Phiên đăng nhập giáo viên không hợp lệ hoặc đã hết hạn.';
  }

  return message || 'Không thể xác minh quyền giáo viên.';
}

function parseStaffContext(data: unknown): StaffContext {
  if (!data || typeof data !== 'object') {
    throw new Error('Không nhận được ngữ cảnh giáo viên hợp lệ từ hệ thống phân quyền.');
  }

  const context = data as StaffContextRpc;

  if (
    !context.user_id
    || !context.full_name
    || context.account_status !== 'approved'
    || !['teacher_moderator', 'admin'].includes(context.role_code)
  ) {
    throw new Error('Ngữ cảnh giáo viên trả về không hợp lệ.');
  }

  return {
    userId: String(context.user_id),
    fullName: String(context.full_name),
    accountStatus: 'approved',
    roleCode: context.role_code as StaffRoleCode,
    schoolId: context.school_id ? String(context.school_id) : null,
    schoolName: context.school_name ? String(context.school_name) : null,
  };
}

export async function getCurrentStaffContext(): Promise<StaffContext> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc('get_current_staff_context');

  if (error) {
    throw new Error(normalizeStaffContextError(error.message));
  }

  return parseStaffContext(data);
}

export async function inspectExistingStaffSession(): Promise<ExistingStaffSessionState> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw new Error(error.message);
  }

  if (!data.session) {
    return {
      kind: 'none',
      sessionExists: false,
      context: null,
      message: '',
    };
  }

  try {
    const context = await getCurrentStaffContext();

    return {
      kind: 'staff',
      sessionExists: true,
      context,
      message: '',
    };
  } catch (contextError) {
    return {
      kind: 'non_staff',
      sessionExists: true,
      context: null,
      message:
        contextError instanceof Error
          ? contextError.message
          : 'Phiên hiện tại không có quyền truy cập cổng giáo viên.',
    };
  }
}

export async function signInStaff(
  input: StaffLoginInput,
): Promise<{ session: Session; context: StaffContext }> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });

  if (error) {
    throw new Error(normalizeCredentialError(error.message));
  }

  if (!data.session || !data.user) {
    throw new Error('Không nhận được phiên đăng nhập giáo viên hợp lệ.');
  }

  try {
    const context = await getCurrentStaffContext();

    if (context.userId !== data.user.id) {
      throw new Error('Ngữ cảnh giáo viên không khớp với phiên Authentication.');
    }

    return {
      session: data.session,
      context,
    };
  } catch (authorizationError) {
    // Authentication may succeed for a Student account. If staff authorization
    // then fails, remove the newly-created local session immediately so the
    // wrong portal cannot retain an authenticated identity.
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // Preserve the original authorization error.
    }

    throw authorizationError;
  }
}

export async function signOutStaff(): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase.auth.signOut({ scope: 'local' });

  if (error) {
    throw new Error(error.message);
  }
}
