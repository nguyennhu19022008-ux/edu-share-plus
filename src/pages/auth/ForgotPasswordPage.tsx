import { FormEvent, useMemo, useState } from 'react';
import { navigateLegacy } from '../../app/legacyRouter';
import {
  readPasswordPortal,
  requestPasswordReset,
  type PasswordPortal,
} from '../../features/auth/password/passwordRecoveryService';

function portalCopy(portal: PasswordPortal) {
  if (portal === 'teacher') {
    return {
      kicker: 'Cổng giáo viên',
      title: 'Khôi phục mật khẩu giáo viên',
      description:
        'Nhập email của tài khoản giáo viên. Hệ thống sẽ gửi liên kết để tạo mật khẩu mới.',
      placeholder: 'giaovien@school.edu.vn',
      loginPage: 'loginGV' as const,
    };
  }

  return {
    kicker: 'Học sinh',
    title: 'Khôi phục mật khẩu học sinh',
    description:
      'Nhập email của tài khoản học sinh. Hệ thống sẽ gửi liên kết để tạo mật khẩu mới.',
    placeholder: 'Nhập email học sinh',
    loginPage: 'loginStudent' as const,
  };
}

export default function ForgotPasswordPage() {
  const portal = readPasswordPortal();
  const copy = useMemo(() => portalCopy(portal), [portal]);

  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();

    setSubmitting(true);
    setSuccess(false);
    setMessage('');

    try {
      await requestPasswordReset(email, portal);
      setSuccess(true);
      setMessage(
        'Nếu email hợp lệ và được hệ thống cho phép gửi thư, liên kết khôi phục mật khẩu đã được gửi. Hãy kiểm tra Hộp thư đến và Spam.',
      );
    } catch (error) {
      setSuccess(false);
      setMessage(
        error instanceof Error
          ? error.message
          : 'Không thể gửi email khôi phục mật khẩu lúc này.',
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

          <h1>{copy.title}</h1>
          <p className="auth-desc">{copy.description}</p>

          <form className="ecom-form" onSubmit={submit}>
            <div className="field">
              <label className="req">Email tài khoản</label>
              <div className="input-icon">
                <span>✉</span>
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder={copy.placeholder}
                  disabled={submitting}
                />
              </div>
            </div>

            <div className={`auth-info ${portal === 'teacher' ? 'teacher-info' : ''}`}>
              Liên kết khôi phục chỉ dùng để đặt lại mật khẩu. Quyền học sinh/giáo viên và trạng thái phê duyệt tài khoản không thay đổi.
            </div>

            <button className="btn primary full" type="submit" disabled={submitting}>
              {submitting ? 'ĐANG GỬI...' : 'GỬI LIÊN KẾT KHÔI PHỤC'}
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
            <button
              className="text-link primary-link"
              type="button"
              onClick={() => navigateLegacy(copy.loginPage)}
            >
              Quay lại đăng nhập
            </button>
            <button
              className="text-link"
              type="button"
              onClick={() => navigateLegacy('landing')}
            >
              ← Trang chủ
            </button>
          </div>
        </section>
      </main>
    </>
  );
}
