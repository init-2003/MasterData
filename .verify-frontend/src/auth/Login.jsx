import React from 'react';
import { ArrowRight, Eye, EyeOff, FlaskConical, KeyRound, LockKeyhole, UserRound } from 'lucide-react';
import sidebarLogo from '../assets/sidebar-logo.jpg';

export function Brand({ light = false }) {
  return <div className={`brand${light ? ' brand-light' : ''}`}><img className="brand-logo" src={sidebarLogo} alt="" /><span>SPTC<span className="brand-dot">.</span></span></div>;
}

export function Login({ app }) {
  return <main className="login-layout">
    <section className="login-poster" aria-labelledby="poster-heading">
      <div className="poster-content"><Brand light /><div className="poster-copy"><div className="poster-line" /><h1 id="poster-heading">Master<br /><span>Data<span className="accent-period">.</span></span></h1><p>ระบบข้อมูลหลักสินค้า</p></div></div>
      <div className="poster-art" aria-hidden="true"><div className="art-outline" /><div className="art-circle" /><div className="art-quarter" /><div className="art-square" /><div className="art-dot" /></div>
    </section>
    <section className="login-side" aria-labelledby="login-heading"><div className="login-content">
      <div className="section-icon" aria-hidden="true"><LockKeyhole /></div><h2 id="login-heading">เข้าสู่ระบบ</h2><p className="muted login-description">ใช้บัญชีของคุณเพื่อเข้าถึงข้อมูลสินค้า</p>
      <form className="login-form" onSubmit={(event) => { event.preventDefault(); app.signIn(); }}>
        <div><label className="field-label" htmlFor="username">ชื่อผู้ใช้</label><div className="field-control"><UserRound aria-hidden="true" /><input id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck="false" placeholder="กรอกชื่อผู้ใช้" maxLength={50} required value={app.username} onChange={(event) => { app.username = event.target.value; }} /></div></div>
        <div><label className="field-label" htmlFor="password">รหัสผ่าน</label><div className="field-control password-field"><KeyRound aria-hidden="true" /><input id="password" name="password" type={app.passwordType} autoComplete="current-password" placeholder="กรอกรหัสผ่าน" maxLength={50} required value={app.password} onChange={(event) => { app.password = event.target.value; }} /><button className="password-toggle" type="button" onClick={() => app.togglePassword()} aria-label={app.passwordLabel} aria-pressed={app.passwordVisible}>{app.passwordVisible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button></div></div>
        {app.loginError && <p className="inline-error" role="alert">{app.loginError}</p>}
        <button className="button button-primary login-submit" type="submit" disabled={app.loginBusy}><span>{app.loginLabel}</span><ArrowRight aria-hidden="true" /></button>
      </form>
      {app.demo && <p className="demo-note"><FlaskConical aria-hidden="true" /> โหมดทดสอบ · ข้อมูลตัวอย่าง</p>}
    </div></section>
  </main>;
}
