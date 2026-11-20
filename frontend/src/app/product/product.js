import { request } from '../../shared/api.js';
import { dialog } from '../../shared/dialog.js';
import { display, number, price, rowRange } from '../../shared/format.js';
import { imageDrafts } from './image-drafts.js';

export function createProduct() {
  let pendingProducts;
  let pendingTypes;
  let pendingUnits;
  let detailTrigger;
  let imageFiles = new Map();
  let imageInputs = new Map();
  let imageRequest;
  let noteRequest;
  let shortNoteRequest;
  let imageToastTimer;
  let draftWrites = Promise.resolve();
  let draftToken;
  try {
    draftToken = sessionStorage.getItem('sptc.image-draft-tab');
    if (!draftToken) { draftToken = crypto.randomUUID(); sessionStorage.setItem('sptc.image-draft-tab', draftToken); }
  } catch { /* Draft persistence is unavailable. */ }
  const draftKey = (user, id, slot) => JSON.stringify([draftToken, user, id, slot]);
  const queueDraft = (operation, onFailure = () => {}) => { draftWrites = draftWrites.catch(() => {}).then(operation).catch(onFailure); };
  const detailStorageKey = 'sptc.open-product';
  const editStorageKey = 'sptc.product-edit';
  const clearSavedEdit = () => { try { sessionStorage.removeItem(editStorageKey); } catch { /* Storage may be unavailable. */ } };
  const clearSavedDetail = () => { try { sessionStorage.removeItem(detailStorageKey); } catch { /* Storage may be unavailable. */ } };

  return {
    detailOpen: false,
    editingDetail: false,
    savingDetail: false,
    detailSaveError: '',
    selectedProduct: {},
    editingPrice: false,
    priceInput: '',
    originalPriceInput: '',
    priceError: '',
    savingPrice: false,
    note: null,
    noteInput: '',
    noteLoading: false,
    noteError: '',
    noteSaving: false,
    editingNote: false,
    shortNote: null,
    shortNoteInput: '',
    shortNoteLoading: false,
    shortNoteError: '',
    shortNoteSaving: false,
    editingShortNote: false,
    imageSlots: [],
    imagesLoading: false,
    imagesError: false,
    imageBusy: false,
    imageSaving: false,
    imageSaveMessage: '',
    imageDraftError: '',
    imageDraftSaving: 0,
    imageToast: '',
    catalogImageVersion: Date.now(),
    catalogError: '',
    productsBusy: false,
    items: [],
    total: 0,
    totalPages: 1,
    page: 1,
    pageSize: 15,
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
    get hasUnsavedText() { return (this.editingPrice && this.priceInput !== this.originalPriceInput) || (this.editingNote && this.noteInput !== (this.note ?? '')) || (this.editingShortNote && this.shortNoteInput !== (this.shortNote ?? '')); },
    get hasUnsavedDetail() { return this.hasUnsavedText || imageFiles.size > 0 || this.imageSlots.some((image) => image.deletePending); },

    clearCatalog() {
      clearTimeout(imageToastTimer);
      this.imageToast = '';
      this.imageSlots.forEach((image) => this.cancelImage(image));
      clearSavedDetail();
      clearSavedEdit();
      pendingProducts?.abort();
      pendingTypes?.abort();
      pendingUnits?.abort();
      imageRequest?.abort();
      noteRequest?.abort();
      shortNoteRequest?.abort();
      imageFiles.clear();
      imageInputs.clear();
      this.detailOpen = false;
      this.sidebarOpen = false;
      this.items = [];
      this.search = '';
      this.searchInput = '';
      this.selectedType = '';
      this.types = [];
      this.typesError = false;
      this.selectedUnit = '';
      this.units = [];
      this.unitsError = false;
      this.page = 1;
      this.total = 0;
      this.totalPages = 1;
      this.catalogError = '';
    },

    async loadProducts(page) {
      pendingProducts?.abort();
      const controller = new AbortController();
      pendingProducts = controller;
      this.productsBusy = true;
      this.catalogError = '';
      this.items = [];
      try {
        const data = await request('products', { query: { q: this.search, type: this.selectedType, unit: this.selectedUnit, page }, signal: controller.signal });
        if (controller.signal.aborted) return;
        Object.assign(this, data);
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error.status === 401) {
          this.clearCatalog();
          this.csrf = '';
          this.user = null;
          this.loginError = 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง';
          return;
        }
        this.catalogError = 'โหลดข้อมูลสินค้าไม่ได้ กรุณาลองอีกครั้ง';
      } finally {
        if (pendingProducts === controller) {
          this.productsBusy = false;
          pendingProducts = undefined;
        }
      }
    },

    async loadTypes() {
      pendingTypes?.abort();
      const controller = new AbortController();
      pendingTypes = controller;
      this.typesBusy = true;
      this.typesError = false;
      try {
        const data = await request('product-types', { signal: controller.signal });
        if (!controller.signal.aborted) this.types = data.items;
      } catch (error) {
        if (!controller.signal.aborted) this.typesError = true;
      } finally {
        if (pendingTypes === controller) { this.typesBusy = false; pendingTypes = undefined; }
      }
    },
    typeChanged() { return this.loadProducts(1); },
    async loadUnits() {
      pendingUnits?.abort();
      const controller = new AbortController();
      pendingUnits = controller;
      this.unitsBusy = true;
      this.unitsError = false;
      try {
        const data = await request('product-units', { signal: controller.signal });
        if (!controller.signal.aborted) this.units = data.items;
      } catch (error) {
        if (!controller.signal.aborted) this.unitsError = true;
      } finally {
        if (pendingUnits === controller) { this.unitsBusy = false; pendingUnits = undefined; }
      }
    },
    unitChanged() { return this.loadProducts(1); },

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
    detailLabel(item) { return `ดูรายละเอียด ${item.name || item.code}`; },

    openProduct(item) {
      detailTrigger = document.activeElement;
      this.selectedProduct = item;
      this.editingPrice = false;
      this.editingDetail = false;
      this.detailSaveError = '';
      this.priceError = '';
      imageFiles.clear();
      imageInputs.clear();
      this.imageSlots = [];
      this.imageSaveMessage = '';
      this.imageDraftError = '';
      this.detailOpen = true;
      try { sessionStorage.setItem(detailStorageKey, JSON.stringify({ id: item.id, code: item.code, username: this.user?.username })); } catch { /* Continue without restore if storage is unavailable. */ }
      const imagesLoaded = Promise.all([this.loadImages(), this.loadNote(), this.loadShortNote()]);
      this.$nextTick(() => this.$refs.detailHeading?.focus());
      return imagesLoaded;
    },
    async restoreProduct() {
      let saved;
      try { saved = JSON.parse(sessionStorage.getItem(detailStorageKey) || 'null'); } catch { return; }
      if (!saved || typeof saved.id !== 'string' || typeof saved.code !== 'string' || !saved.code || saved.username !== this.user?.username) { clearSavedDetail(); return; }
      try {
        let page = 1;
        let data;
        do {
          data = await request('products', { query: { q: saved.code, page } });
          const item = data.items.find((candidate) => candidate.id === saved.id);
          if (item && this.user?.username === saved.username) { await this.openProduct(item); this.restoreDetailEdit(); await this.restoreImageDrafts(); return; }
          page++;
        } while (page <= data.totalPages);
        clearSavedDetail();
        this.catalogError = 'ไม่พบสินค้าที่เปิดไว้ กรุณาค้นหาอีกครั้ง';
      } catch {
        this.catalogError = 'โหลดรายละเอียดสินค้าเดิมไม่ได้ กรุณารีเฟรชหรือลองอีกครั้ง';
      }
    },
    async closeProduct() {
      if (!this.detailOpen) return;
      if (this.savingDetail || this.savingPrice || this.noteSaving || this.shortNoteSaving || this.imageBusy) return;
      if (this.hasUnsavedDetail) {
        const result = await dialog.fire({ titleText: 'ทิ้งการเปลี่ยนแปลง?', text: 'ข้อมูลที่ยังไม่ได้บันทึกจะไม่ถูกนำไปใช้', showCancelButton: true, confirmButtonText: 'ทิ้งการเปลี่ยนแปลง', cancelButtonText: 'กลับไปแก้ไข', customClass: { popup: 'flat-dialog', confirmButton: 'button button-primary', cancelButton: 'button button-muted' } });
        if (!result.isConfirmed) return;
      }
      this.detailOpen = false;
      clearSavedDetail();
      clearSavedEdit();
      imageRequest?.abort();
      noteRequest?.abort();
      shortNoteRequest?.abort();
      this.imageSlots.forEach((image) => this.cancelImage(image));
      imageFiles.clear();
      imageInputs.clear();
      this.$nextTick(() => {
        const replacement = [...document.querySelectorAll('[data-product-id]')].find((button) => button.dataset.productId === this.selectedProduct.id);
        (detailTrigger?.isConnected ? detailTrigger : replacement ?? document.getElementById('catalog-heading'))?.focus();
      });
    },
    editPrice() {
      this.priceInput = (this.selectedProduct.price ?? '').replace(/^(\d+\.\d{2})0+$/, '$1');
      this.originalPriceInput = this.priceInput;
      this.priceError = '';
      this.editingPrice = true;
      this.$nextTick(() => this.$refs.priceInput.focus());
    },
    startDetailEdit() {
      if (this.noteLoading || this.shortNoteLoading || this.imagesLoading || this.noteError || this.shortNoteError || this.imagesError) return;
      this.priceInput = (this.selectedProduct.price ?? '').replace(/^(\d+\.\d{2})0+$/, '$1');
      this.originalPriceInput = this.priceInput;
      this.noteInput = this.note ?? '';
      this.shortNoteInput = this.shortNote ?? '';
      this.priceError = '';
      this.detailSaveError = '';
      this.editingPrice = true;
      this.editingNote = true;
      this.editingShortNote = true;
      this.editingDetail = true;
      this.persistDetailEdit();
    },
    persistDetailEdit() {
      if (!this.editingDetail || !this.detailOpen || !this.user?.username) return;
      try {
        sessionStorage.setItem(editStorageKey, JSON.stringify({
          id: this.selectedProduct.id, username: this.user.username,
          priceInput: this.priceInput, originalPriceInput: this.originalPriceInput, expectedPrice: this.selectedProduct.price,
          noteInput: this.noteInput, expectedNote: this.note,
          shortNoteInput: this.shortNoteInput, expectedShortNote: this.shortNote,
          deletedImages: this.imageSlots.filter((image) => image.deletePending).map((image) => ({ slot: image.slot, expected: image.expectedDeletePath ?? image.path ?? null })),
        }));
      } catch { this.detailSaveError = 'เก็บข้อมูลแก้ไขชั่วคราวไม่ได้ ข้อมูลอาจหายเมื่อรีเฟรช'; }
    },
    restoreDetailEdit() {
      let saved;
      try { saved = JSON.parse(sessionStorage.getItem(editStorageKey) || 'null'); } catch { return; }
      if (!saved || saved.id !== this.selectedProduct.id || saved.username !== this.user?.username) return;
      if (this.noteError || this.shortNoteError || this.imagesError) return;
      this.startDetailEdit();
      this.priceInput = saved.priceInput;
      this.originalPriceInput = saved.originalPriceInput;
      if (saved.priceInput !== saved.originalPriceInput) this.selectedProduct = { ...this.selectedProduct, price: saved.expectedPrice };
      this.noteInput = saved.noteInput;
      if (saved.noteInput !== (saved.expectedNote ?? '')) this.note = saved.expectedNote;
      this.shortNoteInput = saved.shortNoteInput;
      if (saved.shortNoteInput !== (saved.expectedShortNote ?? '')) this.shortNote = saved.expectedShortNote;
      for (const deleted of saved.deletedImages ?? []) {
        const image = this.imageSlots.find((item) => item.slot === deleted.slot);
        if (image) { image.deletePending = true; image.expectedDeletePath = deleted.expected; }
      }
      this.persistDetailEdit();
    },
    async cancelDetailEdit() {
      if (this.savingDetail) return;
      if (this.hasUnsavedDetail) {
        const result = await dialog.fire({ titleText: 'ทิ้งการเปลี่ยนแปลง?', text: 'ข้อมูลที่ยังไม่ได้บันทึกจะไม่ถูกนำไปใช้', showCancelButton: true, confirmButtonText: 'ทิ้งการเปลี่ยนแปลง', cancelButtonText: 'กลับไปแก้ไข', customClass: { popup: 'flat-dialog', confirmButton: 'button button-primary', cancelButton: 'button button-muted' } });
        if (!result.isConfirmed) return;
      }
      this.cancelImages();
      this.imageSlots.forEach((image) => { image.deletePending = false; });
      this.priceInput = this.originalPriceInput;
      this.noteInput = this.note ?? '';
      this.shortNoteInput = this.shortNote ?? '';
      this.priceError = '';
      this.noteError = '';
      this.shortNoteError = '';
      this.detailSaveError = '';
      this.editingPrice = false;
      this.editingNote = false;
      this.editingShortNote = false;
      this.editingDetail = false;
      clearSavedEdit();
    },
    async saveDetail() {
      if (this.savingDetail) return;
      this.priceError = '';
      this.detailSaveError = '';
      if (this.priceInput !== this.originalPriceInput && !/^\d{1,13}(?:\.\d{1,2})?$/.test(this.priceInput)) this.priceError = 'กรอกราคาตั้งแต่ 0 และทศนิยมไม่เกิน 2 ตำแหน่ง';
      if (this.noteInput.length > 4000) this.noteError = 'คำอธิบายยาวเกิน 4,000 ตัวอักษร';
      if (this.shortNoteInput.length > 255) this.shortNoteError = 'คำอธิบายโดยย่อยาวเกิน 255 ตัวอักษร';
      if (this.priceError || this.noteInput.length > 4000 || this.shortNoteInput.length > 255 || this.imageSlots.some((image) => image.invalid)) { this.detailSaveError = 'กรุณาตรวจสอบข้อมูลที่ระบุก่อนบันทึก'; return; }
      this.savingDetail = true;
      const failures = [];
      const successes = [];
      try {
        if (this.priceInput !== this.originalPriceInput) (await this.savePrice() ? successes : failures).push('ราคาขาย');
        if (this.noteInput !== (this.note ?? '')) (await this.saveNote() ? successes : failures).push('คำอธิบายสินค้า');
        if (this.shortNoteInput !== (this.shortNote ?? '')) (await this.saveShortNote() ? successes : failures).push('คำอธิบายโดยย่อ');
        if (this.imageSlots.some((image) => image.pending)) {
          const slots = this.imageSlots.filter((image) => image.pending).map((image) => image.slot);
          await this.uploadImages(true);
          for (const slot of slots) (this.imageSlots.find((image) => image.slot === slot)?.pending ? failures : successes).push(`รูปที่ ${slot}`);
        }
        for (const image of this.imageSlots.filter((item) => item.deletePending)) {
          try {
            await request('delete-product-image', { body: { id: this.selectedProduct.id, slot: image.slot, expected: image.expectedDeletePath ?? image.path ?? null }, csrf: this.csrf });
            image.path = null; image.url = ''; image.missing = true; image.deletePending = false; image.error = '';
            if (image.slot === 1) this.catalogImageVersion++;
            successes.push(`รูปที่ ${image.slot}`);
          } catch (error) {
            image.error = error.status === 409 ? 'รูปนี้มีการเปลี่ยนแปลงแล้ว กรุณาปิดและเปิดรายละเอียดใหม่ก่อนลองอีกครั้ง' : 'ลบรูปไม่ได้ กรุณาลองอีกครั้งหรือติดต่อผู้ดูแลระบบ';
            failures.push(`รูปที่ ${image.slot}`);
          }
        }
        if (failures.length) {
          this.detailSaveError = `${successes.length ? `บันทึก ${successes.join(', ')} แล้ว ` : ''}บันทึก ${failures.join(', ')} ไม่สำเร็จ กรุณาตรวจสอบและลองอีกครั้ง`;
        } else {
          this.editingPrice = false; this.editingNote = false; this.editingShortNote = false; this.editingDetail = false;
          clearSavedEdit();
          if (successes.length) this.showImageToast('บันทึกข้อมูลสินค้าแล้ว');
        }
      } finally { this.savingDetail = false; if (this.editingDetail) this.persistDetailEdit(); }
    },
    async loadNote() {
      noteRequest?.abort();
      const controller = new AbortController();
      noteRequest = controller;
      this.note = null;
      this.noteInput = '';
      this.editingNote = false;
      this.noteLoading = true;
      this.noteError = '';
      try {
        const data = await request('product-note', { query: { id: this.selectedProduct.id }, signal: controller.signal });
        if (!controller.signal.aborted) { this.note = data.note; this.noteInput = data.note ?? ''; }
      } catch (error) {
        if (!controller.signal.aborted) this.noteError = 'โหลดคำอธิบายไม่ได้ กรุณาลองอีกครั้ง';
      } finally {
        if (noteRequest === controller) { this.noteLoading = false; noteRequest = undefined; }
      }
    },
    async saveNote() {
      if (this.noteSaving) return;
      this.noteSaving = true;
      this.noteError = '';
      try {
        await request('update-product-note', { body: { id: this.selectedProduct.id, expectedNote: this.note, note: this.noteInput }, csrf: this.csrf });
        this.note = this.noteInput;
        if (!this.editingDetail) this.editingNote = false;
        return true;
      } catch (error) {
        this.noteError = error.status === 409 ? 'คำอธิบายถูกแก้ไขแล้ว กรุณาปิดและเปิดรายละเอียดใหม่ก่อนลองอีกครั้ง' : 'บันทึกคำอธิบายไม่ได้ กรุณาลองอีกครั้งหรือติดต่อผู้ดูแลระบบ';
        return false;
      } finally { this.noteSaving = false; }
    },
    async loadShortNote() {
      shortNoteRequest?.abort();
      const controller = new AbortController();
      shortNoteRequest = controller;
      this.shortNote = null;
      this.shortNoteInput = '';
      this.editingShortNote = false;
      this.shortNoteLoading = true;
      this.shortNoteError = '';
      try {
        const data = await request('product-short-note', { query: { id: this.selectedProduct.id }, signal: controller.signal });
        if (!controller.signal.aborted) { this.shortNote = data.note; this.shortNoteInput = data.note ?? ''; }
      } catch (error) {
        if (!controller.signal.aborted) this.shortNoteError = 'โหลดคำอธิบายโดยย่อไม่ได้ กรุณาลองอีกครั้ง';
      } finally {
        if (shortNoteRequest === controller) { this.shortNoteLoading = false; shortNoteRequest = undefined; }
      }
    },
    async saveShortNote() {
      if (this.shortNoteSaving) return;
      this.shortNoteSaving = true;
      this.shortNoteError = '';
      try {
        await request('update-product-short-note', { body: { id: this.selectedProduct.id, expectedNote: this.shortNote, note: this.shortNoteInput }, csrf: this.csrf });
        this.shortNote = this.shortNoteInput;
        if (!this.editingDetail) this.editingShortNote = false;
        return true;
      } catch (error) {
        this.shortNoteError = error.status === 409 ? 'คำอธิบายโดยย่อถูกแก้ไขแล้ว กรุณาปิดและเปิดรายละเอียดใหม่ก่อนลองอีกครั้ง' : error.status === 422 ? 'คำอธิบายโดยย่อไม่ถูกต้องหรือยาวเกินขนาดที่ฐานข้อมูลรองรับ' : 'บันทึกคำอธิบายโดยย่อไม่ได้ กรุณาลองอีกครั้งหรือติดต่อผู้ดูแลระบบ';
        return false;
      } finally { this.shortNoteSaving = false; }
    },
    async loadImages() {
      imageRequest?.abort();
      const controller = new AbortController();
      imageRequest = controller;
      this.imagesLoading = true;
      this.imagesError = false;
      try {
        const data = await request('product-images', { query: { id: this.selectedProduct.id }, signal: controller.signal });
        if (controller.signal.aborted) return;
        this.imageSlots = data.images.map((item) => ({ ...item, inputId: `product-image-${item.slot}`, url: item.exists ? `./api.php?${new URLSearchParams({ action: 'product-image', id: this.selectedProduct.id, slot: item.slot, v: Date.now().toString() })}` : '', preview: '', error: '', message: '', missing: !item.exists }));
      } catch (error) {
        if (!controller.signal.aborted) this.imagesError = true;
      } finally {
        if (imageRequest === controller) { this.imagesLoading = false; imageRequest = undefined; }
      }
    },
    imageLoaded(image) { image.missing = false; },
    imageFailed(image) { image.missing = true; },
    cancelImage(image) {
      if (draftToken && this.user?.username && this.selectedProduct.id) {
        const key = draftKey(this.user.username, this.selectedProduct.id, image.slot);
        this.imageDraftSaving++;
        queueDraft(async () => { try { await imageDrafts.remove(key); } finally { this.imageDraftSaving--; } }, () => { this.imageDraftError = 'ลบรูปชั่วคราวไม่ได้ กรุณาลองอีกครั้ง'; });
      }
      imageFiles.delete(image.slot);
      if (imageInputs.has(image.slot)) imageInputs.get(image.slot).value = '';
      image.preview = '';
      image.pending = false;
      image.invalid = false;
      image.error = '';
      image.message = '';
      image.expectedPath = undefined;
    },
    selectImage(event, image) {
      const file = event.target.files?.[0];
      if (!file) return;
      this.selectImageFile(file, image, event.target);
    },
    selectImageFile(file, image, input = null, restoredExpected) {
      if (this.imageBusy) return;
      image.deletePending = false;
      image.expectedDeletePath = undefined;
      this.persistDetailEdit();
      if (restoredExpected === undefined && draftToken && this.user?.username && this.selectedProduct.id) {
        const oldKey = draftKey(this.user.username, this.selectedProduct.id, image.slot);
        this.imageDraftSaving++;
        queueDraft(async () => { try { await imageDrafts.remove(oldKey); } finally { this.imageDraftSaving--; } }, () => { this.imageDraftError = 'ลบรูปชั่วคราวไม่ได้ กรุณาลองอีกครั้ง'; });
      }
      imageFiles.delete(image.slot);
      if (imageInputs.has(image.slot) && imageInputs.get(image.slot) !== input) imageInputs.get(image.slot).value = '';
      image.preview = '';
      image.pending = false;
      image.invalid = false;
      image.error = '';
      image.message = '';
      this.imageSaveMessage = '';
      this.imageDraftError = '';
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
        image.invalid = true;
        image.error = 'เลือกรูป JPEG, PNG หรือ WebP ขนาดไม่เกิน 5 MB';
        if (input) input.value = '';
        return;
      }
      imageFiles.set(image.slot, file);
      image.expectedPath = restoredExpected === undefined ? (image.path ?? null) : restoredExpected;
      if (input) imageInputs.set(image.slot, input);
      image.pending = true;
      if (draftToken && this.user?.username && this.selectedProduct.id && restoredExpected === undefined) {
        const key = draftKey(this.user.username, this.selectedProduct.id, image.slot);
        const expected = image.expectedPath;
        this.imageDraftSaving++;
        queueDraft(async () => { try { await imageDrafts.put(key, { file, expected }); } finally { this.imageDraftSaving--; } }, () => { this.imageDraftError = 'เก็บรูปชั่วคราวไม่ได้ รูปอาจหายเมื่อรีเฟรช'; });
      } else if (restoredExpected === undefined && !draftToken) {
        this.imageDraftError = 'เก็บรูปชั่วคราวไม่ได้ รูปอาจหายเมื่อรีเฟรช';
      }
      const reader = new FileReader();
      reader.onload = () => { if (imageFiles.get(image.slot) === file && typeof reader.result === 'string') image.preview = reader.result; };
      reader.onerror = () => { if (imageFiles.get(image.slot) === file) { this.cancelImage(image); image.invalid = true; image.error = 'อ่านไฟล์รูปไม่ได้ กรุณาเลือกใหม่'; } };
      reader.readAsDataURL(file);
    },
    async restoreImageDrafts() {
      if (!draftToken || !this.user?.username || !this.detailOpen) return;
      const id = this.selectedProduct.id;
      const username = this.user.username;
      try {
        await draftWrites;
        for (const image of this.imageSlots) {
          const draft = await imageDrafts.get(draftKey(username, id, image.slot));
          if (!this.detailOpen || this.selectedProduct.id !== id || this.user?.username !== username) return;
          if (draft?.file && !image.pending) { if (!this.editingDetail) this.startDetailEdit(); this.selectImageFile(draft.file, image, null, draft.expected ?? null); }
        }
      } catch { this.imageDraftError = 'โหลดรูปที่เลือกไว้ก่อนรีเฟรชไม่ได้'; }
    },
    cancelImages() {
      if (this.imageBusy) return;
      this.imageSlots.forEach((image) => this.cancelImage(image));
      this.imageSaveMessage = '';
      this.imageDraftError = '';
    },
    showImageToast(message) {
      clearTimeout(imageToastTimer);
      this.imageToast = message;
      imageToastTimer = setTimeout(() => { this.imageToast = ''; }, 3000);
    },
    stageImageDelete(image) {
      if (!this.editingDetail || this.savingDetail) return;
      if (image.pending) this.cancelImage(image);
      if (image.path || !image.missing) { image.deletePending = true; image.expectedDeletePath = image.path ?? null; }
      image.error = '';
      this.persistDetailEdit();
    },
    async deleteImage(image) {
      if (this.imageBusy || (!image.path && image.missing)) return;
      const result = await dialog.fire({ titleText: `ลบรูปที่ ${image.slot}?`, text: 'รูปสินค้านี้จะถูกลบออก', showCancelButton: true, confirmButtonText: 'ลบรูป', cancelButtonText: 'ยกเลิก', customClass: { popup: 'flat-dialog', confirmButton: 'button button-danger', cancelButton: 'button button-muted' } });
      if (!result.isConfirmed || this.imageBusy || !this.detailOpen) return;
      this.imageBusy = true;
      image.error = '';
      image.message = '';
      try {
        await request('delete-product-image', { body: { id: this.selectedProduct.id, slot: image.slot, expected: image.path ?? null }, csrf: this.csrf });
        imageFiles.delete(image.slot);
        if (imageInputs.has(image.slot)) imageInputs.get(image.slot).value = '';
        image.path = null;
        image.url = '';
        image.preview = '';
        image.missing = true;
        if (image.slot === 1) this.catalogImageVersion++;
        this.showImageToast('ลบรูปสินค้าแล้ว');
      } catch (error) {
        image.error = error.status === 409 ? 'รูปนี้มีการเปลี่ยนแปลงแล้ว กรุณาปิดและเปิดรายละเอียดใหม่ก่อนลองอีกครั้ง' : 'ลบรูปไม่ได้ กรุณาลองอีกครั้งหรือติดต่อผู้ดูแลระบบ';
      } finally { this.imageBusy = false; }
    },
    async uploadImages(quiet = false) {
      if (this.imageBusy || this.imageSlots.some((image) => image.invalid)) return;
      const pending = this.imageSlots.filter((image) => image.pending && imageFiles.has(image.slot));
      if (!pending.length) return;
      this.imageBusy = true;
      this.imageSaveMessage = '';
      this.imageSaving = true;
      const succeeded = [];
      try {
        for (const image of pending) {
          const form = new FormData();
          form.append('id', this.selectedProduct.id);
          form.append('slot', String(image.slot));
          form.append('expected', image.expectedPath ?? '');
          form.append('image', imageFiles.get(image.slot));
          image.error = '';
          try {
            const result = await request('upload-product-image', { body: form, csrf: this.csrf });
            this.cancelImage(image);
            image.path = result.path;
            image.url = `./api.php?${new URLSearchParams({ action: 'product-image', id: this.selectedProduct.id, slot: image.slot, v: Date.now().toString() })}`;
            image.missing = false;
            if (image.slot === 1) this.catalogImageVersion++;
            succeeded.push(image.slot);
          } catch (error) {
            image.error = error.status === 409 ? 'รูปนี้มีการเปลี่ยนแปลงแล้ว กรุณาปิดและเปิดรายละเอียดใหม่ก่อนลองอีกครั้ง' : error.status === 413 || error.status === 422 ? 'รูปหรือรหัสสินค้าไม่ถูกต้อง หรือรูปมีขนาดเกิน 5 MB' : 'อัปโหลดรูปไม่ได้ กรุณาลองอีกครั้งหรือติดต่อผู้ดูแลระบบ';
          }
        }
        if (succeeded.length && succeeded.length < pending.length) this.imageSaveMessage = `บันทึกรูปที่ ${succeeded.join(', ')} แล้ว กรุณาตรวจสอบรูปที่บันทึกไม่สำเร็จ`;
        if (!quiet && succeeded.length === pending.length) this.showImageToast('บันทึกรูปสินค้าแล้ว');
      } finally { this.imageSaving = false; this.imageBusy = false; }
    },
    async savePrice() {
      if (this.savingPrice) return;
      if (!/^\d{1,13}(?:\.\d{1,2})?$/.test(this.priceInput)) { this.priceError = 'กรอกราคาตั้งแต่ 0 และทศนิยมไม่เกิน 2 ตำแหน่ง'; return; }
      this.savingPrice = true;
      this.priceError = '';
      try {
        await request('update-price', { body: { id: this.selectedProduct.id, expectedPrice: this.selectedProduct.price, price: this.priceInput }, csrf: this.csrf });
        this.selectedProduct = { ...this.selectedProduct, price: this.priceInput };
        this.originalPriceInput = this.priceInput;
        if (!this.editingDetail) this.editingPrice = false;
        await this.loadProducts(this.page);
        return true;
      } catch (error) {
        this.priceError = error.status === 409 ? 'ราคามีการเปลี่ยนแปลงแล้ว กรุณาปิดรายละเอียดและโหลดรายการใหม่ก่อนแก้ไขอีกครั้ง' : 'บันทึกราคาไม่ได้ กรุณาลองอีกครั้งหรือติดต่อผู้ดูแลระบบ';
        return false;
      } finally { this.savingPrice = false; }
    },
    handleDetailTab(event) {
      const controls = [...event.currentTarget.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled)')].filter((element) => element.getClientRects().length);
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    },
  };
}
