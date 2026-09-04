import { FormEvent, useEffect, useState } from 'react';
import { navigateLegacy } from '../../app/legacyRouter';
import {
  inspectExistingStaffSession,
  signInStaff,
  signOutStaff,
} from '../../features/auth/staff/staffAuthService';

type SessionState = 'checking' | 'none' | 'staff' | 'non_staff';

function statusMessage(status: string | null) {
  if (status === 'staff_required') {
    return 'Bạn cần đăng nhập bằng tài khoản giáo viên hoặc quản trị viên để mở khu vực này.';
  }

  if (status === 'staff_session_error') {
    return 'Không thể xác minh quyền của phiên giáo viên hiện tại. Vui lòng đăng nhập lại.';
  }

  return '';
}

export default function TeacherLoginPage() {
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState>('checking');

  const hasExistingSession =
    sessionState === 'staff' || sessionState === 'non_staff';

  useEffect(() => {
    let cancelled = false;

    const inspect = async () => {
      try {
        const state = await inspectExistingStaffSession();

        if (cancelled) return;

        if (state.kind === 'staff') {
          setSessionState('staff');
          setSuccess(true);
          setMessage(
            'Phiên giáo viên đã được xác minh. Đang mở trang quản trị...',
          );
          navigateLegacy('admin');
          return;
        }

        if (state.kind === 'non_staff') {
          setSessionState('non_staff');
          setSuccess(false);
          setMessage(
            'Trình duyệt đang có một phiên không thuộc cổng giáo viên. Hãy đăng xuất phiên hiện tại trước khi đăng nhập bằng tài khoản giáo viên.',
          );
          return;
        }

        setSessionState('none');

        const params = new URLSearchParams(window.location.search);

        if (params.get('reset') === '1') {
          setSuccess(true);
          setMessage(
            'Mật khẩu đã được cập nhật. Hãy đăng nhập lại bằng mật khẩu mới.',
          );
          return;
        }

        const fromGuard = statusMessage(params.get('status'));

        if (fromGuard) {
          setSuccess(false);
          setMessage(fromGuard);
        }
      } catch (inspectError) {
        if (cancelled) return;

        setSessionState('none');
        setSuccess(false);
        setMessage(
          inspectError instanceof Error
            ? inspectError.message
            : 'Không thể kiểm tra phiên đăng nhập hiện tại.',
        );
      }
    };

    void inspect();

    return () => {
      cancelled = true;
    };
  }, []);

  const logoutCurrentSession = async () => {
    if (submitting) return;

    setSubmitting(true);
    setSuccess(false);
    setMessage('');

    try {
      await signOutStaff();
      setSessionState('none');
      setSuccess(true);
      setMessage(
        'Đã đăng xuất phiên hiện tại. Bây giờ bạn có thể đăng nhập bằng tài khoản giáo viên.',
      );
    } catch (logoutError) {
      setMessage(
        logoutError instanceof Error
          ? logoutError.message
          : 'Không thể đăng xuất phiên hiện tại.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submitting) return;

    if (hasExistingSession) {
      setSuccess(false);
      setMessage(
        'Trình duyệt đang có một phiên đăng nhập. Hãy đăng xuất phiên hiện tại trước khi thử tài khoản khác.',
      );
      return;
    }

    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');

    setSubmitting(true);
    setSuccess(false);
    setMessage('');

    try {
      const { context } = await signInStaff({ email, password });

      setSessionState('staff');
      setSuccess(true);

      const roleLabel =
        context.roleCode === 'admin'
          ? 'Quản trị viên'
          : 'Giáo viên kiểm duyệt';

      setMessage(
        context.schoolName
          ? `Đăng nhập thành công: ${roleLabel} — ${context.schoolName}.`
          : `Đăng nhập thành công: ${roleLabel}.`,
      );

      navigateLegacy('admin');
    } catch (loginError) {
      setSessionState('none');
      setSuccess(false);
      setMessage(
        loginError instanceof Error
          ? loginError.message
          : 'Không thể đăng nhập giáo viên lúc này.',
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
        <b>Edu Share<span>+</span></b>
      </button>

      <main className="auth-market-wrap">
        <section className="auth-market-card">
          <div className="auth-beam-wrap" aria-hidden="true">
            <svg className="auth-beam-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
              <rect className="auth-beam-runner" x="1" y="1" width="98" height="98" rx="4" pathLength="100" />
            </svg>
          </div>

          <div className="auth-kicker teacher">Cổng giáo viên</div>

          <h1 className="auth-bouncy-heading" aria-label="Đăng nhập giáo viên">
            {Array.from('Đăng nhập giáo viên').map((char, index) => (
              <span
                key={index}
                className="auth-bouncy-letter"
                style={{ animationDelay: `${420 + index * 36}ms` }}
                aria-hidden="true"
              >
                {char === ' ' ? '\u00A0' : char}
              </span>
            ))}
          </h1>

          <p className="auth-desc">
            Dùng tài khoản giáo viên để kiểm duyệt bài, xử lý báo cáo và xem
            thống kê hoạt động.
          </p>

          <form className="ecom-form" onSubmit={submit}>
            <div className="field auth-stagger-item auth-stagger-1 auth-from-left">
              <label className="req">Email giáo viên</label>

              <div className="input-icon">
                <svg
                  className="auth-input-svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="username"
                  placeholder="giaovien@school.edu.vn"
                  disabled={
                    submitting ||
                    sessionState === 'checking' ||
                    hasExistingSession
                  }
                />
              </div>
            </div>

            <div className="field auth-stagger-item auth-stagger-2 auth-from-right">
              <div className="label-row">
                <label className="req">Mật khẩu quản trị</label>

                <button
                  type="button"
                  className="text-link"
                  onClick={() =>
                    navigateLegacy('forgotPassword', { portal: 'teacher' })
                  }
                >
                  Quên mật khẩu?
                </button>
              </div>

              <div className="input-icon">
                <svg
                  className="auth-input-svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="Nhập mật khẩu quản trị"
                  disabled={
                    submitting ||
                    sessionState === 'checking' ||
                    hasExistingSession
                  }
                />
              </div>
            </div>

            <div className="auth-info teacher-info auth-stagger-item auth-stagger-3 auth-from-left">
              Khu vực này dành riêng cho giáo viên và ban quản trị. Các thao
              tác kiểm duyệt được ghi vào nhật ký hệ thống.
            </div>

            <button
              className="btn primary full auth-stagger-item auth-stagger-4 auth-from-right"
              type="submit"
              disabled={
                submitting || sessionState === 'checking' || hasExistingSession
              }
            >
              {submitting
                ? 'ĐANG XÁC MINH...'
                : sessionState === 'checking'
                  ? 'ĐANG KIỂM TRA PHIÊN...'
                  : hasExistingSession
                    ? 'ĐANG CÓ PHIÊN ĐĂNG NHẬP'
                    : 'VÀO TRANG QUẢN TRỊ'}
            </button>

            {message && (
              <div
                className={`state checkpoint-state ${
                  success ? 'auth-success-state' : ''
                }`}
              >
                {message}
              </div>
            )}
          </form>

          <div className="auth-bottom">
            <button
              className="text-link primary-link"
              type="button"
              onClick={() => navigateLegacy('loginStudent')}
            >
              Bạn là học sinh? Đăng nhập
            </button>

            {hasExistingSession && (
              <button
                className="text-link"
                type="button"
                disabled={submitting}
                onClick={() => void logoutCurrentSession()}
              >
                Đăng xuất phiên hiện tại
              </button>
            )}

            <button
              className="text-link"
              type="button"
              onClick={() => navigateLegacy('landing')}
            >
              ← Quay lại
            </button>
          </div>
        </section>
      </main>
    </>
  );
}
