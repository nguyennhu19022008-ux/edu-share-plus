import { FormEvent, useState } from 'react';
import { navigateLegacy } from '../../app/legacyRouter';
import { signUpStudent } from '../../features/auth/registration/registrationService';
import { useRegistrationSchools } from '../../features/auth/registration/useRegistrationSchools';

function validatePassword(password: string) {
  if (password.length < 8) return 'Mật khẩu phải có ít nhất 8 ký tự.';
  if (!/[a-z]/.test(password)) return 'Mật khẩu phải có ít nhất một chữ thường.';
  if (!/[A-Z]/.test(password)) return 'Mật khẩu phải có ít nhất một chữ hoa.';
  if (!/\d/.test(password)) return 'Mật khẩu phải có ít nhất một chữ số.';
  return '';
}

export default function StudentRegisterPage() {
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { schools, loading: schoolsLoading, error: schoolsError, reload } = useRegistrationSchools();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const fullName = String(form.get('name') ?? '').trim();
    const schoolId = String(form.get('schoolId') ?? '').trim();
    const className = String(form.get('className') ?? '').trim();
    const phone = String(form.get('phone') ?? '').trim();
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    const confirmPassword = String(form.get('confirmPassword') ?? '');

    setSuccess(false);

    if (!schoolId) {
      setMessage('Vui lòng chọn trường THPT.');
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setMessage(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setMessage('Mật khẩu nhập lại chưa khớp.');
      return;
    }

    setSubmitting(true);
    setMessage('');

    try {
      const result = await signUpStudent({ fullName, schoolId, className, phone, email, password });

      if (!result.user) {
        throw new Error('Không nhận được thông tin tài khoản sau khi đăng ký.');
      }

      formElement.reset();
      setSuccess(true);
      setMessage(
        'Tạo tài khoản thành công. Hãy kiểm tra email và bấm liên kết xác minh. Sau khi xác minh, tài khoản sẽ chờ giáo viên/nhà trường đối chiếu trước khi được sử dụng đầy đủ.',
      );
    } catch (submitError) {
      setMessage(
        submitError instanceof Error
          ? submitError.message
          : 'Không thể tạo tài khoản lúc này. Vui lòng thử lại.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button className="auth-logo checkpoint-reset-button" type="button" onClick={() => navigateLegacy('landing')}>
        <span className="brand-mark">E+</span><b>Edu Share<span>+</span></b>
      </button>
      <main className="auth-market-wrap">
        <section className="auth-market-card auth-wide-card">
          <div className="auth-kicker student">Tạo tài khoản</div>
          <h1>Tạo tài khoản học sinh</h1>
          <p className="auth-desc">Tạo tài khoản để đăng bài, bình luận, lưu bài quan tâm và quản lý hồ sơ cá nhân.</p>
          <form className="ecom-form" onSubmit={submit}>
            <div className="field"><label className="req">Họ và tên</label><input name="name" required maxLength={120} autoComplete="name" placeholder="Nhập họ và tên đầy đủ" disabled={submitting} /></div>

            <div className="field">
              <label className="req">Trường THPT</label>
              <select name="schoolId" required defaultValue="" disabled={schoolsLoading || submitting || schools.length === 0}>
                <option value="" disabled>{schoolsLoading ? 'Đang tải danh sách trường...' : 'Chọn trường'}</option>
                {schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
              </select>
              {schoolsError && (
                <div className="auth-inline-error">
                  <span>{schoolsError}</span>
                  <button type="button" className="text-link primary-link" onClick={() => void reload()} disabled={schoolsLoading}>Thử lại</button>
                </div>
              )}
            </div>

            <div className="grid-2">
              <div className="field"><label className="req">Lớp</label><input name="className" required maxLength={64} placeholder="Ví dụ: 12A1" disabled={submitting} /></div>
              <div className="field"><label className="req">Số điện thoại</label><input name="phone" required maxLength={32} inputMode="tel" autoComplete="tel" placeholder="089xxxx089" disabled={submitting} /></div>
            </div>

            <div className="field"><label className="req">Email</label><input name="email" type="email" required maxLength={320} autoComplete="username" placeholder="hocsinh@thpt.edu.vn" disabled={submitting} /></div>

            <div className="grid-2">
              <div className="field"><label className="req">Mật khẩu</label><input name="password" type="password" required minLength={8} maxLength={80} autoComplete="new-password" placeholder="Tối thiểu 8 ký tự, có hoa, thường và số" disabled={submitting} /></div>
              <div className="field"><label className="req">Nhập lại mật khẩu</label><input name="confirmPassword" type="password" required minLength={8} maxLength={80} autoComplete="new-password" placeholder="Nhập lại mật khẩu" disabled={submitting} /></div>
            </div>

            <div className="auth-info">Email phải được xác minh. Sau đó tài khoản sẽ chờ giáo viên/nhà trường đối chiếu trước khi sử dụng đầy đủ EDU SHARE+.</div>
            <button className="btn primary full" type="submit" disabled={submitting || schoolsLoading || schools.length === 0}>{submitting ? 'ĐANG TẠO TÀI KHOẢN...' : 'TẠO TÀI KHOẢN'}</button>
            {message && <div className={`state checkpoint-state ${success ? 'auth-success-state' : ''}`}>{message}</div>}
          </form>
          <div className="auth-bottom"><button className="text-link primary-link" onClick={() => navigateLegacy('loginStudent')}>Đã có tài khoản? Đăng nhập</button><button className="text-link" onClick={() => navigateLegacy('landing')}>← Quay lại</button></div>
        </section>
      </main>
    </>
  );
}
