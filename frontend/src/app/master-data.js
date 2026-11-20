import { createAuth } from '../auth/auth.js';
import { createProduct } from './product/product.js';
import { loginMessage } from '../shared/api.js';

export function createMasterData() {
  const compactNavigation = window.matchMedia('(max-width: 900px)');
  let onNavigationResize;
  let onBeforeUnload;
  const shell = {
    sidebarOpen: false,
    get accountName() { return this.user?.username ?? ''; },
    get sidebarClass() { return this.sidebarOpen ? 'is-open' : ''; },
    get sidebarRole() { return this.sidebarOpen ? 'dialog' : null; },
    get sidebarModal() { return this.sidebarOpen ? 'true' : null; },
    get sidebarExpanded() { return String(this.sidebarOpen); },
    get backgroundInert() { return this.sidebarOpen || this.detailOpen; },
    async init() {
      onNavigationResize = ({ matches }) => {
        if (!matches && this.sidebarOpen) {
          this.sidebarOpen = false;
          this.$nextTick(() => this.$refs.catalogLink.focus());
        }
      };
      compactNavigation.addEventListener('change', onNavigationResize);
      onBeforeUnload = (event) => {
        if (!this.hasUnsavedText && !this.imageSlots.some((image) => image.deletePending) && !this.imageDraftSaving && !this.imageDraftError && !this.imageBusy && !this.savingDetail && !this.savingPrice && !this.noteSaving && !this.shortNoteSaving) return;
        event.preventDefault();
        event.returnValue = '';
      };
      window.addEventListener('beforeunload', onBeforeUnload);
      try {
        await this.restoreSession();
        if (this.user) { this.loadTypes(); this.loadUnits(); await this.loadProducts(1); }
      } catch (error) {
        this.loginError = loginMessage(error);
      } finally {
        this.booting = false;
      }
      if (this.user) this.restoreProduct();
    },

    destroy() {
      compactNavigation.removeEventListener('change', onNavigationResize);
      window.removeEventListener('beforeunload', onBeforeUnload);
    },

    openSidebar() {
      this.sidebarOpen = true;
      this.$nextTick(() => this.$refs.sidebarClose.focus());
    },

    closeSidebar() {
      if (!this.sidebarOpen) return;
      this.sidebarOpen = false;
      this.$nextTick(() => this.$refs.sidebarToggle.focus());
    },

    handleSidebarTab(event) {
      if (!this.sidebarOpen) return;
      const first = this.$refs.sidebarClose;
      const last = this.$refs.sidebarLogout.disabled ? this.$refs.catalogLink : this.$refs.sidebarLogout;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },

    async showProducts() {
      this.sidebarOpen = false;
      if (this.detailOpen) {
        await this.closeProduct();
        if (this.detailOpen) return;
      }
      this.$nextTick(() => document.getElementById('catalog-heading')?.focus());
    },

  };
  return Object.defineProperties({}, {
    ...Object.getOwnPropertyDescriptors(createAuth()),
    ...Object.getOwnPropertyDescriptors(createProduct()),
    ...Object.getOwnPropertyDescriptors(shell),
  });
}
