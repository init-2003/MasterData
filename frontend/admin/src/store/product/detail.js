import { request } from '../../services/api.js';
import { dialog } from '../../utils/dialog.js';
import { validateWebsiteImageUrl } from '../../utils/website-image-url.js';

// Product detail drawer: opening, editing, restoring and saving, including the price.
export function createDetail(context) {
  const { imageFiles, imageInputs, detailStorageKey, editStorageKey, clearSavedEdit, clearSavedDetail } = context;
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
    get hasUnsavedText() { return (this.editingPrice && this.priceInput !== this.originalPriceInput) || (this.editingNote && this.noteInput !== (this.note ?? '')) || (this.editingShortNote && this.shortNoteInput !== (this.shortNote ?? '')); },
    get hasUnsavedDetail() { return this.hasUnsavedText || imageFiles.size > 0 || this.imageSlots.some((image) => image.deletePending || image.urlPending); },
    detailLabel(item) { return `ดูรายละเอียด ${item.name || item.code}`; },
    openProduct(item) {
      context.detailTrigger = document.activeElement;
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
      context.requests.images?.abort();
      context.requests.note?.abort();
      context.requests.shortNote?.abort();
      this.imageSlots.forEach((image) => this.cancelImage(image));
      imageFiles.clear();
      imageInputs.clear();
      this.$nextTick(() => {
        const replacement = [...document.querySelectorAll('[data-product-id]')].find((button) => button.dataset.productId === this.selectedProduct.id);
        (context.detailTrigger?.isConnected ? context.detailTrigger : replacement ?? document.getElementById('catalog-heading'))?.focus();
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
          urlImages: this.imageSlots.filter((image) => image.urlPending).map((image) => ({ slot: image.slot, urlInput: image.urlInput ?? '', expected: image.expectedUrlPath ?? image.path ?? null })),
          imageModes: this.imageSlots.map((image) => ({ slot: image.slot, mode: image.mode === 'url' ? 'url' : 'upload' })),
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
      for (const modeEntry of saved.imageModes ?? []) {
        const image = this.imageSlots.find((item) => item.slot === modeEntry.slot);
        if (image && (modeEntry.mode === 'upload' || modeEntry.mode === 'url')) image.mode = modeEntry.mode;
      }
      for (const deleted of saved.deletedImages ?? []) {
        const image = this.imageSlots.find((item) => item.slot === deleted.slot);
        if (image) { image.deletePending = true; image.expectedDeletePath = deleted.expected; }
      }
      for (const entry of saved.urlImages ?? []) {
        const image = this.imageSlots.find((item) => item.slot === entry.slot);
        if (image) this.setImageUrlInput(image, entry.urlInput ?? '', entry.expected ?? null);
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
      this.imageSlots.forEach((image) => {
        image.deletePending = false;
        image.expectedDeletePath = undefined;
        image.mode = image.sourceType === 'url' ? 'url' : 'upload';
        image.urlInput = image.originalUrl ?? '';
        image.urlPending = false;
        image.urlValid = Boolean(image.originalUrl);
        image.normalizedUrl = image.originalUrl ?? '';
        image.urlPreviewFailed = false;
        image.expectedUrlPath = undefined;
        image.invalid = false;
        image.error = '';
      });
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
      for (const image of this.imageSlots.filter((item) => item.urlPending)) {
        const check = validateWebsiteImageUrl(image.urlInput ?? '', {
          allowedHosts: this.productImageConfig.allowedImageHosts,
          maxLength: this.slotMaxLength(image.slot),
          asciiOnly: true,
        });
        image.urlValid = check.valid;
        image.normalizedUrl = check.url;
        image.invalid = !check.valid;
        image.error = check.valid ? '' : check.error;
      }
      if (this.priceError || this.noteInput.length > 4000 || this.shortNoteInput.length > 255 || this.imageSlots.some((image) => image.invalid)) {
        this.detailSaveError = 'กรุณาตรวจสอบข้อมูลที่ระบุก่อนบันทึก';
        this.showToast?.(this.detailSaveError, 'error', { announce: false });
        return;
      }
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
        await this.saveImageLinksAndDeletions(successes, failures);
        if (failures.length) {
          this.detailSaveError = `${successes.length ? `บันทึก ${successes.join(', ')} แล้ว ` : ''}บันทึก ${failures.join(', ')} ไม่สำเร็จ กรุณาตรวจสอบและลองอีกครั้ง`;
          this.showToast?.(successes.length ? 'บันทึกข้อมูลบางส่วนไม่สำเร็จ กรุณาตรวจสอบ' : 'บันทึกข้อมูลสินค้าไม่สำเร็จ กรุณาตรวจสอบ', 'error', { announce: false });
        } else {
          this.editingPrice = false; this.editingNote = false; this.editingShortNote = false; this.editingDetail = false;
          clearSavedEdit();
          if (successes.length) this.showToast?.('บันทึกข้อมูลสินค้าแล้ว');
        }
      } finally { this.savingDetail = false; if (this.editingDetail) this.persistDetailEdit(); }
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
  };
}
