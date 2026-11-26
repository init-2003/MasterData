import React from 'react';
import { Eye, EyeOff, FlaskConical, KeyRound, UserRound } from 'lucide-react';
import { Brand } from '../components/Brand.jsx';

export function Login({ app }) {
  return <main className="login-layout">
    <Brand />
    <section className="login-card" aria-labelledby="login-heading">
      <h1 id="login-heading">เข้าสู่ระบบ</h1><p className="muted login-description">ใช้บัญชีผู้ดูแลระบบของคุณ</p>
      <form className="login-form" onSubmit={(event) => { event.preventDefault(); app.signIn(); }}>
        <div><label className="field-label" htmlFor="username">ชื่อผู้ใช้</label><div className="field-control"><UserRound aria-hidden="true" /><input id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck="false" placeholder="กรอกชื่อผู้ใช้" maxLength={50} required value={app.username} onChange={(event) => { app.username = event.target.value; }} /></div></div>
        <div><label className="field-label" htmlFor="password">รหัสผ่าน</label><div className="field-control password-field"><KeyRound aria-hidden="true" /><input id="password" name="password" type={app.passwordType} autoComplete="current-password" placeholder="กรอกรหัสผ่าน" maxLength={50} required value={app.password} onChange={(event) => { app.password = event.target.value; }} /><button className="password-toggle" type="button" onClick={() => app.togglePassword()} aria-label={app.passwordLabel} aria-pressed={app.passwordVisible}>{app.passwordVisible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button></div></div>
        <label className="remember-username"><input type="checkbox" checked={app.rememberUsername} onChange={(event) => app.setRememberUsername(event.target.checked)} /> จำชื่อผู้ใช้</label>
        {app.loginError && <p className="inline-error" role="alert">{app.loginError}</p>}
        <button className="button button-primary login-submit" type="submit" disabled={app.loginBusy}><span>{app.loginLabel}</span></button>
      </form>
      {app.demo && <p className="demo-note"><FlaskConical aria-hidden="true" /> โหมดทดสอบ · ข้อมูลตัวอย่าง</p>}
    </section>
    <p className="login-footnote">Admin Console · ระบบจัดการหลังบ้าน</p>
  </main>;
}
