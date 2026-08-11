import { FormEvent, useState } from 'react';
import { navigateLegacy } from '../../app/legacyRouter';

export default function TeacherLoginPage() {
  const [message, setMessage] = useState('');
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    navigateLegacy('admin');
  };

  return (
    <>
      <button className="auth-logo checkpoint-reset-button" type="button" onClick={() => navigateLegacy('landing')}><span className="brand-mark">E+</span><b>Edu Share<span>+</span></b></button>
      <main className="auth-market-wrap">
        <section className="auth-market-card">
          <div className="auth-kicker teacher">Cổng giáo viên</div>
          <h1>Đăng nhập giáo viên</h1>
          <p className="auth-desc">Dùng tài khoản giáo viên để kiểm duyệt bài, xử lý báo cáo và xem thống kê hoạt động.</p>
          <form className="ecom-form" onSubmit={submit}>
            <div className="field"><label className="req">Email giáo viên</label><div className="input-icon"><span>✉</span><input name="email" type="email" required autoComplete="username" placeholder="giaovien@school.edu.vn" /></div></div>
            <div className="field"><div className="label-row"><label className="req">Mật khẩu quản trị</label><button type="button" className="text-link" onClick={() => setMessage('Khôi phục mật khẩu giáo viên sẽ được xử lý trong Authentication phase.')}>Quên mật khẩu?</button></div><div className="input-icon"><span>◆</span><input name="password" type="password" required autoComplete="current-password" placeholder="Nhập mật khẩu quản trị" /></div></div>
            <div className="auth-info teacher-info">Khu vực này dành riêng cho giáo viên và ban quản trị. Các thao tác kiểm duyệt được ghi vào nhật ký hệ thống.</div>
            <button className="btn primary full" type="submit">VÀO TRANG QUẢN TRỊ</button>
            {message && <div className="state checkpoint-state">{message}</div>}
          </form>
          <div className="auth-bottom"><button className="text-link primary-link" onClick={() => navigateLegacy('loginStudent')}>Bạn là học sinh? Đăng nhập</button><button className="text-link" onClick={() => navigateLegacy('landing')}>← Quay lại</button></div>
        </section>
      </main>
    </>
  );
}
