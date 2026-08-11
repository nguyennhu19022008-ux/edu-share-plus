import { FormEvent, useState } from 'react';
import { navigateLegacy } from '../../app/legacyRouter';

export default function StudentRegisterPage() {
  const [message, setMessage] = useState('');
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get('password') !== form.get('confirmPassword')) {
      setMessage('Mật khẩu nhập lại chưa khớp.');
      return;
    }
    setMessage('');
    navigateLegacy('index');
  };

  return (
    <>
      <button className="auth-logo checkpoint-reset-button" type="button" onClick={() => navigateLegacy('landing')}><span className="brand-mark">E+</span><b>Edu Share<span>+</span></b></button>
      <main className="auth-market-wrap">
        <section className="auth-market-card auth-wide-card">
          <div className="auth-kicker student">Tạo tài khoản</div>
          <h1>Tạo tài khoản học sinh</h1>
          <p className="auth-desc">Tạo tài khoản để đăng bài, bình luận, lưu bài quan tâm và quản lý hồ sơ cá nhân.</p>
          <form className="ecom-form" onSubmit={submit}>
            <div className="field"><label className="req">Họ và tên</label><input name="name" required maxLength={120} autoComplete="name" placeholder="Nhập họ và tên đầy đủ" /></div>
            <div className="grid-2"><div className="field"><label className="req">Lớp</label><input name="className" required maxLength={50} placeholder="Ví dụ: 12A1" /></div><div className="field"><label className="req">Số điện thoại</label><input name="phone" required maxLength={80} inputMode="tel" autoComplete="tel" placeholder="089xxxx089" /></div></div>
            <div className="field"><label className="req">Email</label><input name="email" type="email" required autoComplete="username" placeholder="hocsinh@thpt.edu.vn" /></div>
            <div className="grid-2"><div className="field"><label className="req">Mật khẩu</label><input name="password" type="password" required minLength={6} maxLength={80} autoComplete="new-password" placeholder="Tối thiểu 6 ký tự, gồm chữ và số" /></div><div className="field"><label className="req">Nhập lại mật khẩu</label><input name="confirmPassword" type="password" required minLength={6} maxLength={80} autoComplete="new-password" placeholder="Nhập lại mật khẩu" /></div></div>
            <div className="auth-info">Không dùng số điện thoại, email hoặc mật khẩu quá dễ đoán. Mật khẩu được lưu ở dạng mã hóa trong hệ thống.</div>
            <button className="btn primary full" type="submit">TẠO TÀI KHOẢN</button>
            {message && <div className="state checkpoint-state">{message}</div>}
          </form>
          <div className="auth-bottom"><button className="text-link primary-link" onClick={() => navigateLegacy('loginStudent')}>Đã có tài khoản? Đăng nhập</button><button className="text-link" onClick={() => navigateLegacy('landing')}>← Quay lại</button></div>
        </section>
      </main>
    </>
  );
}
