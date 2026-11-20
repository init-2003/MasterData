import { loginMessage, request } from '../shared/api.js';
import { dialog } from '../shared/dialog.js';

export function createAuth() {
  return {
    booting: true,
    user: null,
    csrf: '',
    demo: false,
    username: '',
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
        this.password = '';
        this.passwordVisible = false;
        this.loadTypes();
        this.loadUnits();
        this.loadProducts(1);
        this.$nextTick(() => document.getElementById('catalog-heading')?.focus());
      } catch (error) {
        if (error.status === 403) this.csrf = '';
        this.loginError = loginMessage(error);
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
        this.$nextTick(() => document.getElementById('username')?.focus());
      } catch (error) {
        if (error.status === 403) {
          try {
            await this.restoreSession();
            if (!this.user) {
              this.clearCatalog();
              return;
            }
          } catch {
            // The visible error below also covers loss of connectivity.
          }
        }
        dialog.fire({ titleText: 'ออกจากระบบไม่สำเร็จ', text: 'กรุณาลองอีกครั้ง' });
      } finally {
        this.logoutBusy = false;
      }
    },

  };
}
