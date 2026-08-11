import { FormEvent, useState } from 'react';
import { navigateLegacy } from '../../app/legacyRouter';

export default function StudentLoginPage() {
  const [message, setMessage] = useState('');
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    const search = new URLSearchParams(window.location.search).get('search')?.trim() || '';
    navigateLegacy('index', search ? { search } : {});
  };

  return (
    <>
      <button className="auth-logo checkpoint-reset-button" type="button" onClick={() => navigateLegacy('landing')}><span className="brand-mark">E+</span><b>Edu Share<span>+</span></b></button>
      <main className="auth-market-wrap">
        <section className="auth-market-card">
          <div className="auth-kicker student">Học sinh</div>
          <h1>Đăng nhập học sinh</h1>
          <p className="auth-desc">Dùng email và mật khẩu tài khoản học sinh để đăng nhập hệ thống.</p>
          <form className="ecom-form" onSubmit={submit}>
            <div className="field"><label className="req">Email</label><div className="input-icon"><span>✉</span><input name="email" type="email" required autoComplete="username" placeholder="Nhập email học sinh" /></div></div>
            <div className="field"><div className="label-row"><label className="req">Mật khẩu</label><button type="button" className="text-link" onClick={() => setMessage('Khôi phục mật khẩu sẽ được kết nối cùng Authentication ở Phase 4.')}>Quên mật khẩu?</button></div><div className="input-icon"><span>●</span><input name="password" type="password" required autoComplete="current-password" placeholder="Nhập mật khẩu" /></div></div>
            <div className="auth-info">Tài khoản tạo trước bản này có thể đăng nhập lần đầu bằng <b>số điện thoại cũ</b>, sau đó vào Hồ sơ để đổi mật khẩu mới.</div>
            <button className="btn primary full" type="submit">ĐĂNG NHẬP</button>
            {message && <div className="state checkpoint-state">{message}</div>}
          </form>
          <div className="auth-bottom"><button className="text-link primary-link" onClick={() => navigateLegacy('registerStudent')}>Tạo tài khoản học sinh</button><button className="text-link" onClick={() => navigateLegacy('landing')}>← Quay lại</button></div>
        </section>
      </main>
    </>
  );
}
