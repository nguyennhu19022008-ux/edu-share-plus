import { validateNewPassword } from '../auth/password/passwordRecoveryService';

export function validateProfilePasswordChange(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
): string | null {
  if (!currentPassword) {
    return 'Vui lòng nhập mật khẩu hiện tại trước khi đổi mật khẩu.';
  }

  if (newPassword !== confirmPassword) {
    return 'Mật khẩu mới nhập lại chưa khớp.';
  }

  return validateNewPassword(newPassword);
}
