import { FormEvent, useEffect, useState } from 'react';
import { navigateLegacy } from '../../app/legacyRouter';
import { useStudentAuth } from '../../features/auth/session/AuthSessionProvider';
import {
  getStudentSessionProfile,
  signInStudent,
  signOutStudent,
} from '../../features/auth/session/authService';
import {
  navigateToRelativeTarget,
  readSafeStudentReturnTarget,
} from '../../features/auth/session/routeAccess';
import type { StudentAccountStatus } from '../../features/auth/session/types';

function accountStatusMessage(status: StudentAccountStatus | 'profile_error') {
  if (status === 'pending_review') {
    return 'Email đã được xác minh, nhưng tài khoản vẫn đang chờ giáo viên/nhà trường đối chiếu. Bạn chưa thể vào khu vực học sinh.';
  }

  if (status === 'rejected') {
    return 'Yêu cầu tài khoản hiện chưa được nhà trường chấp thuận. Vui lòng liên hệ giáo viên phụ trách nếu cần kiểm tra lại.';
  }

  if (status === 'suspended') {
    return 'Tài khoản đang bị tạm khóa. Vui lòng liên hệ giáo viên/nhà trường để được hỗ trợ.';
  }

  return 'Phiên đăng nhập tồn tại nhưng hồ sơ học sinh chưa tải được. Vui lòng đăng xuất rồi thử lại hoặc liên hệ giáo viên phụ trách.';
}

export default function StudentLoginPage() {
  const auth = useStudentAuth();

  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const hasExistingSession = Boolean(auth.session);

  useEffect(() => {
    if (!auth.authReady || auth.profileLoading || submitting) return;

    const params = new URLSearchParams(window.location.search);
    const status = params.get('status') as
      | StudentAccountStatus
      | 'profile_error'
      | null;
    const confirmed = params.get('confirmed') === '1';

    if (
      status &&
      ['pending_review', 'rejected', 'suspended', 'profile_error'].includes(
        status,
      )
    ) {
      setSuccess(false);
      setMessage(accountStatusMessage(status));
      return;
    }

    if (confirmed && auth.profile?.accountStatus === 'pending_review') {
      setSuccess(true);
      setMessage(
        'Xác minh email thành công. Trình duyệt hiện đang có một phiên Supabase. Tài khoản vẫn chờ giáo viên/nhà trường đối chiếu. Nếu muốn kiểm tra đăng nhập bằng mật khẩu, hãy bấm “Đăng xuất phiên hiện tại” trước.',
      );
      return;
    }

    if (confirmed && !auth.session) {
      setSuccess(true);
      setMessage(
        'Email đã được xác minh. Bạn có thể đăng nhập; sau đó hệ thống sẽ kiểm tra trạng thái phê duyệt của nhà trường.',
      );
      return;
    }

    if (auth.session) {
      setSuccess(false);
      setMessage(
        'Trình duyệt đang có một phiên đăng nhập Supabase. Để đăng nhập lại bằng email/mật khẩu hoặc kiểm tra sai mật khẩu, hãy đăng xuất phiên hiện tại trước.',
      );
    }
  }, [
    auth.authReady,
    auth.profile?.accountStatus,
    auth.profileLoading,
    auth.session,
    submitting,
  ]);

  const logoutCurrentSession = async () => {
    if (submitting) return;

    setSubmitting(true);
    setSuccess(false);
    setMessage('');

    try {
      await auth.signOut();
      setSuccess(true);
      setMessage(
        'Đã đăng xuất phiên hiện tại. Bây giờ bạn có thể kiểm tra đăng nhập bằng email và mật khẩu.',
      );
    } catch (logoutError) {
      setMessage(
        logoutError instanceof Error
          ? logoutError.message
          : 'Không thể đăng xuất lúc này.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submitting) return;

    if (auth.session) {
      setSuccess(false);
      setMessage(
        'Bạn đang có một phiên đăng nhập từ trước. Hãy bấm “Đăng xuất phiên hiện tại” rồi thử đăng nhập lại.',
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
      const session = await signInStudent({ email, password });

      let profile;

      try {
        // Student authorization MUST succeed after credential authentication.
        // A valid Teacher/Admin password is not enough to enter Student Portal.
        profile = await getStudentSessionProfile(session.user.id);
      } catch (authorizationError) {
        // signInWithPassword has already created a valid Supabase Auth session.
        // If Student authorization fails, remove that newly-created session
        // immediately so a staff/non-student identity cannot remain active in
        // the Student Portal and mask the real authorization error.
        try {
          await signOutStudent();
        } catch {
          // Preserve the original authorization error for the user.
        }

        throw authorizationError;
      }

      auth.acceptLogin(session, profile);

      if (profile.accountStatus !== 'approved') {
        setMessage(accountStatusMessage(profile.accountStatus));
        return;
      }

      const returnTarget = readSafeStudentReturnTarget();

      if (returnTarget) {
        navigateToRelativeTarget(returnTarget);
        return;
      }

      const search =
        new URLSearchParams(window.location.search).get('search')?.trim() || '';

      navigateLegacy('index', search ? { search } : {});
    } catch (submitError) {
      setSuccess(false);
      setMessage(
        submitError instanceof Error
          ? submitError.message
          : 'Không thể đăng nhập lúc này. Vui lòng thử lại.',
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
          <div className="auth-kicker student">Học sinh</div>

          <h1>Đăng nhập học sinh</h1>

          <p className="auth-desc">
            Dùng email và mật khẩu tài khoản học sinh để đăng nhập hệ thống.
          </p>

          <form className="ecom-form" onSubmit={submit}>
            <div className="field">
              <label className="req">Email</label>

              <div className="input-icon">
                <span>✉</span>
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="username"
                  placeholder="Nhập email học sinh"
                  disabled={submitting || hasExistingSession}
                />
              </div>
            </div>

            <div className="field">
              <div className="label-row">
                <label className="req">Mật khẩu</label>

                <button
                  type="button"
                  className="text-link"
                  onClick={() =>
                    setMessage(
                      'Khôi phục mật khẩu sẽ được nối với Supabase Auth ở checkpoint tiếp theo.',
                    )
                  }
                >
                  Quên mật khẩu?
                </button>
              </div>

              <div className="input-icon">
                <span>●</span>
                <input
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="Nhập mật khẩu"
                  disabled={submitting || hasExistingSession}
                />
              </div>
            </div>

            <div className="auth-info">
              Email phải được xác minh và tài khoản phải được giáo viên/nhà
              trường phê duyệt trước khi sử dụng đầy đủ khu vực học sinh.
            </div>

            <button
              className="btn primary full"
              type="submit"
              disabled={submitting || hasExistingSession}
            >
              {submitting
                ? 'ĐANG ĐĂNG NHẬP...'
                : hasExistingSession
                  ? 'ĐANG CÓ PHIÊN ĐĂNG NHẬP'
                  : 'ĐĂNG NHẬP'}
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
              onClick={() => navigateLegacy('registerStudent')}
            >
              Tạo tài khoản học sinh
            </button>

            {auth.session && (
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
