import { request } from '../../services/api.js';
import { display, number, price, rowRange } from '../../utils/format.js';

// Product list: search, filters, paging and the type and unit choices.
export function createCatalog(context) {
  const { pageSizeKey, initialPageSize } = context;
  return {
    catalogImageVersion: Date.now(),
    catalogError: '',
    productsBusy: false,
    items: [],
    total: 0,
    totalPages: 1,
    page: 1,
    pageSize: initialPageSize,
    searchInput: '',
    search: '',
    types: [],
    selectedType: '',
    typesBusy: false,
    typesError: false,
    units: [],
    selectedUnit: '',
    unitsBusy: false,
    unitsError: false,
    display,
    price,
    get showTypeStatus() { return this.typesBusy || this.typesError; },
    get showUnitStatus() { return this.unitsBusy || this.unitsError; },
    get showEmpty() { return !this.productsBusy && !this.catalogError && this.items.length === 0; },
    get showPagination() { return !this.productsBusy && !this.catalogError && this.total > 0; },
    get atFirstPage() { return this.productsBusy || this.page <= 1; },
    get atLastPage() { return this.productsBusy || this.page >= this.totalPages; },
    get resultCount() { return this.productsBusy || this.catalogError ? '' : `${number.format(this.total)} รายการ`; },
    get pageLabel() { return `หน้า ${number.format(this.page)} / ${number.format(this.totalPages)}`; },
    get resultRange() { return rowRange(this.page, this.pageSize, this.total); },
    async loadProducts(page) {
      context.requests.products?.abort();
      const controller = new AbortController();
      context.requests.products = controller;
      this.dismissToastMessage?.(this.catalogError);
      this.productsBusy = true;
      this.catalogError = '';
      this.items = [];
      try {
        const data = await request('products', { query: { q: this.search, type: this.selectedType, unit: this.selectedUnit, page, pageSize: this.pageSize }, signal: controller.signal });
        if (controller.signal.aborted) return;
        Object.assign(this, data);
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error.status === 401) {
          this.clearCatalog();
          this.csrf = '';
          this.user = null;
          this.loginError = 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง';
          this.showToast?.(this.loginError, 'error', { announce: false });
          return;
        }
        this.catalogError = 'โหลดข้อมูลสินค้าไม่ได้ กรุณาลองอีกครั้ง';
        this.showToast?.(this.catalogError, 'error', { announce: false });
      } finally {
        if (context.requests.products === controller) {
          this.productsBusy = false;
          context.requests.products = undefined;
        }
      }
    },
    async loadTypes() {
      this.dismissToastMessage?.('โหลดประเภทสินค้าไม่ได้ กรุณาลองอีกครั้ง');
      context.requests.types?.abort();
      const controller = new AbortController();
      context.requests.types = controller;
      this.typesBusy = true;
      this.typesError = false;
      try {
        const data = await request('product-types', { signal: controller.signal });
        if (!controller.signal.aborted) this.types = data.items;
      } catch (error) {
        if (!controller.signal.aborted) {
          this.typesError = true;
          this.showToast?.('โหลดประเภทสินค้าไม่ได้ กรุณาลองอีกครั้ง', 'error', { announce: false });
        }
      } finally {
        if (context.requests.types === controller) { this.typesBusy = false; context.requests.types = undefined; }
      }
    },
    typeChanged() { return this.loadProducts(1); },
    async loadUnits() {
      this.dismissToastMessage?.('โหลดหน่วยสินค้าไม่ได้ กรุณาลองอีกครั้ง');
      context.requests.units?.abort();
      const controller = new AbortController();
      context.requests.units = controller;
      this.unitsBusy = true;
      this.unitsError = false;
      try {
        const data = await request('product-units', { signal: controller.signal });
        if (!controller.signal.aborted) this.units = data.items;
      } catch (error) {
        if (!controller.signal.aborted) {
          this.unitsError = true;
          this.showToast?.('โหลดหน่วยสินค้าไม่ได้ กรุณาลองอีกครั้ง', 'error', { announce: false });
        }
      } finally {
        if (context.requests.units === controller) { this.unitsBusy = false; context.requests.units = undefined; }
      }
    },
    unitChanged() { return this.loadProducts(1); },
    changePageSize(nextSize) {
      const parsed = typeof nextSize === 'number' ? nextSize : Number.parseInt(String(nextSize).trim(), 10);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 500) {
        this.showToast?.('กรุณากรอกจำนวนต่อหน้า 1–500 รายการ', 'error');
        return false;
      }
      this.dismissToastMessage?.('กรุณากรอกจำนวนต่อหน้า 1–500 รายการ');
      if (parsed === this.pageSize) return true;
      this.pageSize = parsed;
      try { sessionStorage.setItem(pageSizeKey, String(parsed)); } catch { /* Storage may be unavailable. */ }
      this.loadProducts(1);
      return true;
    },
    submitSearch() {
      this.search = this.searchInput.trim();
      return this.loadProducts(1);
    },
    clearSearch() {
      this.searchInput = '';
      this.$refs.search.focus();
      return this.submitSearch();
    },
    previousPage() { if (!this.atFirstPage) return this.loadProducts(this.page - 1); },
    nextPage() { if (!this.atLastPage) return this.loadProducts(this.page + 1); },
    refresh() { return this.loadProducts(this.page); },
  };
}
