import { loginMessage, request } from '../services/api.js';
import { dialog } from '../utils/dialog.js';

export function createAuth() {
  const rememberKey = 'sptc.remembered-username';
  let rememberedUsername = '';
  try { rememberedUsername = localStorage.getItem(rememberKey) || ''; } catch { /* Storage may be unavailable. */ }
  return {
    booting: true,
    user: null,
    csrf: '',
    demo: false,
    username: rememberedUsername,
    rememberUsername: rememberedUsername !== '',
    password: '',
    passwordVisible: false,
    loginBusy: false,
    logoutBusy: false,
    loginError: '',
    get showLogin() { return !this.booting && this.user === null; },
    get showCatalog() { return !this.booting && this.user !== null; },
    get passwordHidden() { return !this.passwordVisible; },
    get passwordType() { return this.passwordVisible ? 'text' : 'password'; },
    get passwordLabel() { return this.passwordVisible ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'; },
    get loginLabel() { return this.loginBusy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'; },
    async restoreSession() {
      this.applySession(await request('session'));
    },

    applySession(session) {
      this.user = session.user;
      this.csrf = session.csrf;
      this.demo = session.demo;
    },

    togglePassword() { this.passwordVisible = !this.passwordVisible; },
    setRememberUsername(remember) {
      this.rememberUsername = remember;
      if (!remember) { try { localStorage.removeItem(rememberKey); } catch { /* Storage may be unavailable. */ } }
    },

    async signIn() {
      if (this.loginBusy) return;
      this.loginBusy = true;
      this.loginError = '';
      try {
        if (!this.csrf) await this.restoreSession();
        if (!this.user) {
          this.applySession(await request('login', {
            body: { username: this.username, password: this.password },
            csrf: this.csrf,
          }));
        }
        try {
          if (this.rememberUsername) localStorage.setItem(rememberKey, this.username.trim());
          else localStorage.removeItem(rememberKey);
        } catch { /* Login remains available without storage. */ }
        this.password = '';
        this.passwordVisible = false;
        this.restoreSidebarPreference();
        this.showToast?.('เข้าสู่ระบบแล้ว');
        this.loadTypes();
        this.loadUnits();
        this.loadProducts(1);
        this.$nextTick(() => {
          if (this.isCompact && this.sidebarOpen) this.$refs.sidebarClose?.focus();
          else document.getElementById('catalog-heading')?.focus();
        });
      } catch (error) {
        if (error.status === 403) this.csrf = '';
        this.loginError = loginMessage(error);
        this.showToast?.(this.loginError, 'error');
      } finally {
        this.loginBusy = false;
      }
    },

    async signOut() {
      if (this.logoutBusy) return;
      this.logoutBusy = true;
      try {
        const session = await request('logout', { body: {}, csrf: this.csrf });
        this.clearCatalog();
        this.applySession(session);
        this.showToast?.('ออกจากระบบแล้ว');
        this.$nextTick(() => document.getElementById('username')?.focus());
      } catch (error) {
        if (error.status === 403) {
          try {
            await this.restoreSession();
            if (!this.user) {
              this.clearCatalog();
              this.showToast?.('ออกจากระบบแล้ว');
              return;
            }
          } catch {
            // The visible error below also covers loss of connectivity.
          }
        }
        this.showToast?.('ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง', 'error');
        dialog.fire({ titleText: 'ออกจากระบบไม่สำเร็จ', text: 'กรุณาลองอีกครั้ง' });
      } finally {
        this.logoutBusy = false;
      }
    },

  };
}
