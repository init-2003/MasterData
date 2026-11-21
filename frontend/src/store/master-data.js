import { createAuth } from './auth.js';
import { createProduct } from './product/product.js';
import { createToast } from './toast.js';
import { loginMessage } from '../services/api.js';

export function createMasterData() {
  const compactNavigation = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(max-width: 900px)') : null;
  const sidebarKey = (compact) => `sptc.sidebar.${compact ? 'mobile' : 'desktop'}`;
  const savedSidebar = (compact) => {
    try {
      const value = sessionStorage.getItem(sidebarKey(compact));
      if (value === 'open' || value === 'closed') return value === 'open';
    } catch { /* Use the default when storage is unavailable. */ }
    return !compact;
  };
  let onNavigationResize;
  const shell = {
    isCompact: compactNavigation?.matches ?? false,
    sidebarOpen: savedSidebar(compactNavigation?.matches ?? false),
    get accountName() { return this.user?.username ?? ''; },
    get sidebarClass() { return this.sidebarOpen ? 'is-open' : ''; },
    get sidebarRole() { return this.sidebarOpen && this.isCompact ? 'dialog' : null; },
    get sidebarModal() { return this.sidebarOpen && this.isCompact ? 'true' : null; },
    get sidebarExpanded() { return String(this.sidebarOpen); },
    get backgroundInert() { return (this.sidebarOpen && this.isCompact) || this.detailOpen; },
    async init() {
      onNavigationResize = ({ matches }) => { this.isCompact = matches; this.sidebarOpen = savedSidebar(matches); };
      compactNavigation?.addEventListener('change', onNavigationResize);
      try {
        await this.restoreSession();
        if (this.user) { this.loadTypes(); this.loadUnits(); await this.loadProducts(1); }
      } catch (error) {
        this.loginError = loginMessage(error);
      } finally {
        this.booting = false;
      }
      if (this.user) this.restoreProduct();
      if (this.user && this.isCompact && this.sidebarOpen) this.$nextTick(() => { if (!this.detailOpen) this.$refs.sidebarClose?.focus(); });
    },

    destroy() { compactNavigation?.removeEventListener('change', onNavigationResize); },

    restoreSidebarPreference() { this.sidebarOpen = savedSidebar(this.isCompact); },
    saveSidebarPreference() { try { sessionStorage.setItem(sidebarKey(this.isCompact), this.sidebarOpen ? 'open' : 'closed'); } catch { /* Continue without persistence. */ } },

    openSidebar() {
      this.sidebarOpen = true;
      this.saveSidebarPreference();
      if (this.isCompact) this.$nextTick(() => this.$refs.sidebarClose.focus());
    },

    toggleSidebar() { if (this.sidebarOpen) this.closeSidebar(); else this.openSidebar(); },

    closeSidebar() {
      if (!this.sidebarOpen) return;
      this.sidebarOpen = false;
      this.saveSidebarPreference();
      this.$nextTick(() => this.$refs.sidebarToggle.focus());
    },

    handleSidebarTab(event) {
      if (!this.sidebarOpen || !this.isCompact) return;
      const first = this.$refs.sidebarClose;
      const last = this.$refs.catalogLink;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },

    async showProducts() {
      if (this.isCompact) { this.sidebarOpen = false; this.saveSidebarPreference(); }
      if (this.detailOpen) {
        await this.closeProduct();
        if (this.detailOpen) return;
      }
      this.$nextTick(() => document.getElementById('catalog-heading')?.focus());
    },

  };
  return Object.defineProperties({}, {
    ...Object.getOwnPropertyDescriptors(createToast()),
    ...Object.getOwnPropertyDescriptors(createAuth()),
    ...Object.getOwnPropertyDescriptors(createProduct()),
    ...Object.getOwnPropertyDescriptors(shell),
  });
}
