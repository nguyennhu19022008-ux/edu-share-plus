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
import {
  inspectExistingStaffSession,
  signInStaff,
  signOutStaff,
} from '../../features/auth/staff/staffAuthService';

export type AuthRole = 'student' | 'teacher';

interface AuthLoginFormProps {
  role: AuthRole;
}

type TeacherSessionState = 'checking' | 'none' | 'staff' | 'non_staff';

function studentAccountStatusMessage(status: StudentAccountStatus | 'profile_error') {
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

function teacherStatusMessage(status: string | null) {
  if (status === 'staff_required') {
    return 'Bạn cần đăng nhập bằng tài khoản giáo viên hoặc quản trị viên để mở khu vực này.';
  }
  if (status === 'staff_session_error') {
    return 'Không thể xác minh quyền của phiên giáo viên hiện tại. Vui lòng đăng nhập lại.';
  }
  return '';
}

export function AuthLoginForm({ role }: AuthLoginFormProps) {
  const isTeacher = role === 'teacher';
  const auth = useStudentAuth();

  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [teacherSessionState, setTeacherSessionState] = useState<TeacherSessionState>('checking');

  const hasExistingSession = isTeacher
    ? teacherSessionState === 'staff' || teacherSessionState === 'non_staff'
    : Boolean(auth.session);

  // Student auth state initialization
  useEffect(() => {
    if (isTeacher) return;
    if (!auth.authReady || auth.profileLoading || submitting) return;

    const params = new URLSearchParams(window.location.search);
    const status = params.get('status') as StudentAccountStatus | 'profile_error' | null;
    const confirmed = params.get('confirmed') === '1';
    const passwordReset = params.get('reset') === '1';

    if (passwordReset && !auth.session) {
      setSuccess(true);
      setMessage('Mật khẩu đã được cập nhật. Hãy đăng nhập lại bằng mật khẩu mới.');
      return;
    }

    if (status && ['pending_review', 'rejected', 'suspended', 'profile_error'].includes(status)) {
      setSuccess(false);
      setMessage(studentAccountStatusMessage(status));
      return;
    }

    if (confirmed && auth.profile?.accountStatus === 'pending_review') {
      setSuccess(true);
      setMessage(
        'Xác minh email thành công. Trình duyệt hiện đang có một phiên Supabase. Tài khoản vẫn chờ giáo viên/nhà trường đối chiếu. Nếu muốn kiểm tra đăng nhập bằng mật khẩu, hãy bấm “Đăng xuất phiên hiện tại” trước.'
      );
      return;
    }

    if (confirmed && !auth.session) {
      setSuccess(true);
      setMessage(
        'Email đã được xác minh. Bạn có thể đăng nhập; sau đó hệ thống sẽ kiểm tra trạng thái phê duyệt của nhà trường.'
      );
      return;
    }

    if (auth.session) {
      setSuccess(false);
      setMessage(
        'Trình duyệt đang có một phiên đăng nhập Supabase. Để đăng nhập lại bằng email/mật khẩu hoặc kiểm tra sai mật khẩu, hãy đăng xuất phiên hiện tại trước.'
      );
    }
  }, [
    isTeacher,
    auth.authReady,
    auth.profile?.accountStatus,
    auth.profileLoading,
    auth.session,
    submitting,
  ]);

  // Teacher auth state initialization
  useEffect(() => {
    if (!isTeacher) return;
    let cancelled = false;

    const inspect = async () => {
      try {
        const state = await inspectExistingStaffSession();
        if (cancelled) return;

        if (state.kind === 'staff') {
          setTeacherSessionState('staff');
          setSuccess(true);
          setMessage('Phiên giáo viên đã được xác minh. Đang mở trang quản trị...');
          navigateLegacy('admin');
          return;
        }

        if (state.kind === 'non_staff') {
          setTeacherSessionState('non_staff');
          setSuccess(false);
          setMessage(
            'Trình duyệt đang có một phiên không thuộc cổng giáo viên. Hãy đăng xuất phiên hiện tại trước khi đăng nhập bằng tài khoản giáo viên.'
          );
          return;
        }

        setTeacherSessionState('none');

        const params = new URLSearchParams(window.location.search);
        if (params.get('reset') === '1') {
          setSuccess(true);
          setMessage('Mật khẩu đã được cập nhật. Hãy đăng nhập lại bằng mật khẩu mới.');
          return;
        }

        const fromGuard = teacherStatusMessage(params.get('status'));
        if (fromGuard) {
          setSuccess(false);
          setMessage(fromGuard);
        }
      } catch (inspectError) {
        if (cancelled) return;
        setTeacherSessionState('none');
        setSuccess(false);
        setMessage(
          inspectError instanceof Error
            ? inspectError.message
            : 'Không thể kiểm tra phiên đăng nhập hiện tại.'
        );
      }
    };

    void inspect();
    return () => {
      cancelled = true;
    };
  }, [isTeacher]);

  const logoutCurrentSession = async () => {
    if (submitting) return;
    setSubmitting(true);
    setSuccess(false);
    setMessage('');

    try {
      if (isTeacher) {
        await signOutStaff();
        setTeacherSessionState('none');
        setSuccess(true);
        setMessage(
          'Đã đăng xuất phiên hiện tại. Bây giờ bạn có thể đăng nhập bằng tài khoản giáo viên.'
        );
      } else {
        await auth.signOut();
        setSuccess(true);
        setMessage(
          'Đã đăng xuất phiên hiện tại. Bây giờ bạn có thể kiểm tra đăng nhập bằng email và mật khẩu.'
        );
      }
    } catch (logoutError) {
      setMessage(
        logoutError instanceof Error
          ? logoutError.message
          : 'Không thể đăng xuất phiên hiện tại.'
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
        isTeacher
          ? 'Trình duyệt đang có một phiên đăng nhập. Hãy đăng xuất phiên hiện tại trước khi thử tài khoản khác.'
          : 'Bạn đang có một phiên đăng nhập từ trước. Hãy bấm “Đăng xuất phiên hiện tại” rồi thử đăng nhập lại.'
      );
      return;
    }

    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');

    setSubmitting(true);
    setSuccess(false);
    setMessage('');

    if (isTeacher) {
      try {
        const { context } = await signInStaff({ email, password });
        setTeacherSessionState('staff');
        setSuccess(true);

        const roleLabel =
          context.roleCode === 'admin' ? 'Quản trị viên' : 'Giáo viên kiểm duyệt';

        setMessage(
          context.schoolName
            ? `Đăng nhập thành công: ${roleLabel} — ${context.schoolName}.`
            : `Đăng nhập thành công: ${roleLabel}.`
        );

        navigateLegacy('admin');
      } catch (loginError) {
        setTeacherSessionState('none');
        setSuccess(false);
        setMessage(
          loginError instanceof Error
            ? loginError.message
            : 'Không thể đăng nhập giáo viên lúc này.'
        );
      } finally {
        setSubmitting(false);
      }
    } else {
      try {
        const session = await signInStudent({ email, password });
        let profile;

        try {
          profile = await getStudentSessionProfile(session.user.id);
        } catch (authorizationError) {
          try {
            await signOutStudent();
          } catch {
            // Preserve original authorization error
          }
          throw authorizationError;
        }

        auth.acceptLogin(session, profile);

        if (profile.accountStatus !== 'approved') {
          setMessage(studentAccountStatusMessage(profile.accountStatus));
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
            : 'Không thể đăng nhập lúc này. Vui lòng thử lại.'
        );
      } finally {
        setSubmitting(false);
      }
    }
  };

  const headingText = isTeacher ? 'Đăng nhập giáo viên' : 'Đăng nhập học sinh';

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
          <div className="auth-beam-wrap" aria-hidden="true">
            <svg className="auth-beam-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
              <rect className="auth-beam-runner" x="1" y="1" width="98" height="98" rx="4" pathLength="100" />
            </svg>
          </div>

          <div className={`auth-kicker ${isTeacher ? 'teacher' : 'student'}`}>
            {isTeacher ? 'Cổng giáo viên' : 'Học sinh'}
          </div>

          <h1 className="auth-bouncy-heading" aria-label={headingText}>
            {Array.from(headingText).map((char, index) => (
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
            {isTeacher
              ? 'Dùng tài khoản giáo viên để kiểm duyệt bài, xử lý báo cáo và xem thống kê hoạt động.'
              : 'Dùng email và mật khẩu tài khoản học sinh để đăng nhập hệ thống.'}
          </p>

          <form className="ecom-form" onSubmit={submit}>
            <div className="field auth-stagger-item auth-stagger-1 auth-from-left">
              <label className="req">{isTeacher ? 'Email giáo viên' : 'Email'}</label>
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
                  placeholder={isTeacher ? 'giaovien@school.edu.vn' : 'Nhập email học sinh'}
                  disabled={
                    submitting || (isTeacher && teacherSessionState === 'checking') || hasExistingSession
                  }
                />
              </div>
            </div>

            <div className="field auth-stagger-item auth-stagger-2 auth-from-right">
              <div className="label-row">
                <label className="req">{isTeacher ? 'Mật khẩu quản trị' : 'Mật khẩu'}</label>
                <button
                  type="button"
                  className="text-link"
                  onClick={() =>
                    navigateLegacy('forgotPassword', { portal: isTeacher ? 'teacher' : 'student' })
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
                  placeholder={isTeacher ? 'Nhập mật khẩu quản trị' : 'Nhập mật khẩu'}
                  disabled={
                    submitting || (isTeacher && teacherSessionState === 'checking') || hasExistingSession
                  }
                />
              </div>
            </div>

            <div
              className={`auth-info ${isTeacher ? 'teacher-info' : ''} auth-stagger-item auth-stagger-3 auth-from-left`}
            >
              {isTeacher
                ? 'Khu vực này dành riêng cho giáo viên và ban quản trị. Các thao tác kiểm duyệt được ghi vào nhật ký hệ thống.'
                : 'Email phải được xác minh và tài khoản phải được giáo viên/nhà trường phê duyệt trước khi sử dụng đầy đủ khu vực học sinh.'}
            </div>

            <button
              className="btn primary full auth-stagger-item auth-stagger-4 auth-from-right"
              type="submit"
              disabled={
                submitting || (isTeacher && teacherSessionState === 'checking') || hasExistingSession
              }
            >
              {submitting
                ? isTeacher
                  ? 'ĐANG XÁC MINH...'
                  : 'ĐANG ĐĂNG NHẬP...'
                : isTeacher && teacherSessionState === 'checking'
                  ? 'ĐANG KIỂM TRA PHIÊN...'
                  : hasExistingSession
                    ? 'ĐANG CÓ PHIÊN ĐĂNG NHẬP'
                    : isTeacher
                      ? 'VÀO TRANG QUẢN TRỊ'
                      : 'ĐĂNG NHẬP'}
            </button>

            {message && (
              <div className={`state checkpoint-state ${success ? 'auth-success-state' : ''}`}>
                {message}
              </div>
            )}
          </form>

          <div className="auth-bottom">
            {isTeacher ? (
              <button
                className="text-link primary-link"
                type="button"
                onClick={() => navigateLegacy('loginStudent')}
              >
                Bạn là học sinh? Đăng nhập
              </button>
            ) : (
              <button
                className="text-link primary-link"
                type="button"
                onClick={() => navigateLegacy('registerStudent')}
              >
                Tạo tài khoản học sinh
              </button>
            )}

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

            <button className="text-link" type="button" onClick={() => navigateLegacy('landing')}>
              ← Quay lại
            </button>
          </div>
        </section>
      </main>
    </>
  );
}
