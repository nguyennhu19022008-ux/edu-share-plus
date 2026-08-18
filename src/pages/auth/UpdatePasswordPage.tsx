import { FormEvent, useEffect, useMemo, useState } from 'react';
import { navigateLegacy } from '../../app/legacyRouter';
import { getSupabaseClient } from '../../lib/supabase/client';
import {
  hasPasswordRecoveryMarker,
  markPasswordRecovery,
  readPasswordPortal,
  updateRecoveredPassword,
  validateNewPassword,
  type PasswordPortal,
} from '../../features/auth/password/passwordRecoveryService';

type RecoveryState = 'checking' | 'ready' | 'invalid';

function portalCopy(portal: PasswordPortal) {
  if (portal === 'teacher') {
    return {
      kicker: 'Cổng giáo viên',
      loginPage: 'loginGV' as const,
    };
  }

  return {
    kicker: 'Học sinh',
    loginPage: 'loginStudent' as const,
  };
}

export default function UpdatePasswordPage() {
  const portal = readPasswordPortal();
  const copy = useMemo(() => portalCopy(portal), [portal]);

  const [recoveryState, setRecoveryState] = useState<RecoveryState>('checking');
  const [message, setMessage] = useState('Đang xác minh liên kết khôi phục mật khẩu...');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseClient();
    let cancelled = false;
    let ready = false;

    const acceptRecovery = () => {
      if (cancelled) return;
      ready = true;
      markPasswordRecovery();
      setRecoveryState('ready');
      setSuccess(true);
      setMessage('Liên kết khôi phục hợp lệ. Hãy tạo mật khẩu mới.');
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        acceptRecovery();
      }
    });

    const inspect = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (cancelled || ready) return;

      if (!error && session && hasPasswordRecoveryMarker()) {
        acceptRecovery();
        return;
      }

      window.setTimeout(() => {
        if (cancelled || ready) return;
        setRecoveryState('invalid');
        setSuccess(false);
        setMessage(
          'Không tìm thấy phiên khôi phục mật khẩu hợp lệ. Liên kết có thể đã hết hạn, đã được sử dụng hoặc không được mở đúng cách.',
        );
      }, 1200);
    };

    void inspect();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || recoveryState !== 'ready') return;

    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') ?? '');
    const confirmPassword = String(form.get('confirmPassword') ?? '');

    const validation = validateNewPassword(password);
    if (validation) {
      setSuccess(false);
      setMessage(validation);
      return;
    }

    if (password !== confirmPassword) {
      setSuccess(false);
      setMessage('Mật khẩu xác nhận không khớp với mật khẩu mới.');
      return;
    }

    setSubmitting(true);
    setSuccess(false);
    setMessage('');

    try {
      await updateRecoveredPassword(password);
      setSuccess(true);
      setMessage('Đã cập nhật mật khẩu. Đang chuyển về trang đăng nhập...');
      navigateLegacy(copy.loginPage, { reset: '1' });
    } catch (error) {
      setSuccess(false);
      setMessage(
        error instanceof Error
          ? error.message
          : 'Không thể cập nhật mật khẩu mới.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        className="auth-logo checkpoint-reset-button"
        type="button"
        onClick={() => navigateLegacy('landing')}
      >
        <span className="brand-mark">E+</span>
        <b>
          Edu Share<span>+</span>
        </b>
      </button>

      <main className="auth-market-wrap">
        <section className="auth-market-card">
          <div className={`auth-kicker ${portal === 'teacher' ? 'teacher' : 'student'}`}>
            {copy.kicker}
          </div>

          <h1>Tạo mật khẩu mới</h1>
          <p className="auth-desc">
            Mật khẩu mới phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường và chữ số.
          </p>

          <form className="ecom-form" onSubmit={submit}>
            <div className="field">
              <label className="req">Mật khẩu mới</label>
              <div className="input-icon">
                <span>●</span>
                <input
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Nhập mật khẩu mới"
                  disabled={submitting || recoveryState !== 'ready'}
                />
              </div>
            </div>

            <div className="field">
              <label className="req">Xác nhận mật khẩu mới</label>
              <div className="input-icon">
                <span>●</span>
                <input
                  name="confirmPassword"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Nhập lại mật khẩu mới"
                  disabled={submitting || recoveryState !== 'ready'}
                />
              </div>
            </div>

            <div className={`auth-info ${portal === 'teacher' ? 'teacher-info' : ''}`}>
              Đổi mật khẩu không thay đổi role, trường, trạng thái phê duyệt hoặc dữ liệu hồ sơ EDU SHARE+.
            </div>

            <button
              className="btn primary full"
              type="submit"
              disabled={submitting || recoveryState !== 'ready'}
            >
              {submitting
                ? 'ĐANG CẬP NHẬT...'
                : recoveryState === 'checking'
                  ? 'ĐANG XÁC MINH LIÊN KẾT...'
                  : recoveryState === 'invalid'
                    ? 'LIÊN KẾT KHÔNG HỢP LỆ'
                    : 'CẬP NHẬT MẬT KHẨU'}
            </button>

            {message && (
              <div
                className={`state checkpoint-state ${success ? 'auth-success-state' : ''}`}
                role="status"
              >
                {message}
              </div>
            )}
          </form>

          <div className="auth-bottom">
            {recoveryState === 'invalid' && (
              <button
                className="text-link primary-link"
                type="button"
                onClick={() => navigateLegacy('forgotPassword', { portal })}
              >
                Yêu cầu liên kết mới
              </button>
            )}
            <button
              className="text-link"
              type="button"
              onClick={() => navigateLegacy(copy.loginPage)}
            >
              ← Quay lại đăng nhập
            </button>
          </div>
        </section>
      </main>
    </>
  );
}
