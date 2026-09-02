import { getSupabaseClient } from '../../../lib/supabase/client';
import { getPasswordResetRedirectUrl } from '../../../lib/supabase/siteUrl';

export type PasswordPortal = 'student' | 'teacher';

const RECOVERY_MARKER_KEY = 'edu-share-plus:password-recovery';

export function markPasswordRecovery(): void {
  window.sessionStorage.setItem(RECOVERY_MARKER_KEY, '1');
}

export function clearPasswordRecoveryMarker(): void {
  window.sessionStorage.removeItem(RECOVERY_MARKER_KEY);
}

export function hasPasswordRecoveryMarker(): boolean {
  return window.sessionStorage.getItem(RECOVERY_MARKER_KEY) === '1';
}

export function readPasswordPortal(): PasswordPortal {
  const portal = new URLSearchParams(window.location.search).get('portal');
  return portal === 'teacher' ? 'teacher' : 'student';
}

export function passwordRedirectUrl(portal: PasswordPortal): string {
  return getPasswordResetRedirectUrl(portal);
}

function normalizeRecoveryRequestError(message: string): string {
  const normalized = message.toLowerCase();

  if (
    normalized.includes('rate limit')
    || normalized.includes('too many requests')
    || normalized.includes('email rate limit exceeded')
  ) {
    return 'Bạn vừa yêu cầu khôi phục mật khẩu quá nhiều lần. Vui lòng đợi rồi thử lại.';
  }

  if (normalized.includes('email address not authorized')) {
    return 'Dịch vụ email phát triển hiện chưa được phép gửi tới địa chỉ này. Hãy kiểm tra cấu hình SMTP/Auth của Supabase.';
  }

  return message || 'Không thể gửi email khôi phục mật khẩu lúc này.';
}

export async function requestPasswordReset(
  email: string,
  portal: PasswordPortal,
): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: passwordRedirectUrl(portal),
  });

  if (error) {
    throw new Error(normalizeRecoveryRequestError(error.message));
  }
}

export function validateNewPassword(password: string): string | null {
  if (password.length < 8) {
    return 'Mật khẩu mới phải có ít nhất 8 ký tự.';
  }
  if (!/[a-z]/.test(password)) {
    return 'Mật khẩu mới phải có ít nhất 1 chữ thường.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Mật khẩu mới phải có ít nhất 1 chữ hoa.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Mật khẩu mới phải có ít nhất 1 chữ số.';
  }
  return null;
}

export async function updateRecoveredPassword(password: string): Promise<void> {
  const supabase = getSupabaseClient();

  if (!hasPasswordRecoveryMarker()) {
    throw new Error(
      'Phiên hiện tại không được xác nhận là phiên khôi phục mật khẩu. Hãy mở lại liên kết trong email khôi phục.',
    );
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    throw new Error(
      'Liên kết khôi phục không còn phiên hợp lệ hoặc đã hết hạn. Hãy yêu cầu một email khôi phục mới.',
    );
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    throw new Error(error.message || 'Không thể cập nhật mật khẩu mới.');
  }

  clearPasswordRecoveryMarker();

  const { error: signOutError } = await supabase.auth.signOut({
    scope: 'local',
  });

  if (signOutError) {
    throw new Error(
      'Mật khẩu đã được cập nhật nhưng không thể đóng phiên khôi phục. Hãy đóng tab này rồi đăng nhập lại bằng mật khẩu mới.',
    );
  }
}
