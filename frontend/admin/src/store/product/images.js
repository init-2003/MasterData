import { adminApiUrl, request } from '../../services/api.js';
import { dialog } from '../../utils/dialog.js';
import { imageDrafts } from '../../services/image-drafts.js';
import { validateWebsiteImageUrl } from '../../utils/website-image-url.js';

// The drawer's two product image slots: loading, choosing, uploading, linking, deleting and drafts.
export function createImages(context) {
  const { imageFiles, imageInputs, draftToken, draftKey, queueDraft } = context;
  return {
    imageSlots: [],
    productImageConfig: { uploadEnabled: true, allowedImageHosts: [], maxImageUrlLength: 200, slotMaxLengths: { '1': 200, '2': 200 } },
    imagesLoading: false,
    imagesError: false,
    imageBusy: false,
    imageSaving: false,
    imageSaveMessage: '',
    imageDraftError: '',
    imageDraftSaving: 0,
    slotMaxLength(slot) {
      const value = Number(this.productImageConfig?.slotMaxLengths?.[String(slot)] ?? this.productImageConfig?.maxImageUrlLength ?? 200);
      return Number.isInteger(value) && value > 0 ? value : 200;
    },
    async loadImages() {
      context.requests.images?.abort();
      const controller = new AbortController();
      context.requests.images = controller;
      this.imagesLoading = true;
      this.imagesError = false;
      try {
        const data = await request('product-images', { query: { id: this.selectedProduct.id }, signal: controller.signal });
        if (controller.signal.aborted) return;
        if (data.config) this.productImageConfig = data.config;
        this.imageSlots = data.images.map((item) => {
          const sourceType = item.sourceType ?? (item.exists ? 'upload' : null);
          const initialMode = sourceType === 'url' ? 'url' : 'upload';
          const initialUrl = sourceType === 'url' ? (item.imageUrl ?? '') : '';
          return {
            ...item,
            inputId: `product-image-${item.slot}`,
            sourceType,
            imageUrl: item.imageUrl ?? null,
            mode: initialMode,
            urlInput: initialUrl,
            originalUrl: initialUrl,
            urlPending: false,
            urlValid: Boolean(initialUrl),
            normalizedUrl: initialUrl,
            urlPreviewFailed: false,
            url: item.exists
              ? (sourceType === 'url'
                ? (item.preview || '')
                : adminApiUrl('product-image', { id: this.selectedProduct.id, slot: String(item.slot), v: Date.now().toString() }))
              : '',
            preview: '',
            error: '',
            message: '',
            missing: !item.exists,
          };
        });
      } catch (error) {
        if (!controller.signal.aborted) this.imagesError = true;
      } finally {
        if (context.requests.images === controller) { this.imagesLoading = false; context.requests.images = undefined; }
      }
    },
    switchImageMode(image, nextMode) {
      if (this.imageBusy || this.savingDetail || image.mode === nextMode) return;
      image.mode = nextMode;
      image.error = '';
      image.invalid = false;
      image.urlPreviewFailed = false;
      if (nextMode === 'url') {
        if (image.pending) this.cancelImage(image);
        image.deletePending = false;
        image.expectedDeletePath = undefined;
      } else {
        image.urlPending = false;
        image.urlInput = image.originalUrl ?? '';
        image.urlValid = Boolean(image.originalUrl);
        image.normalizedUrl = image.originalUrl ?? '';
        image.expectedUrlPath = undefined;
      }
      this.persistDetailEdit();
    },
    setImageUrlInput(image, value, restoredExpected) {
      if (this.imageBusy || this.savingDetail) return;
      image.deletePending = false;
      image.expectedDeletePath = undefined;
      if (image.pending) this.cancelImage(image);
      image.mode = 'url';
      image.urlInput = value;
      image.urlPreviewFailed = false;
      image.error = '';
      image.invalid = false;
      const trimmed = value.trim();
      const original = (image.originalUrl ?? '').trim();
      if (trimmed !== original) {
        if (trimmed !== '') {
          image.urlPending = true;
          if (restoredExpected !== undefined) image.expectedUrlPath = restoredExpected;
          else if (image.expectedUrlPath === undefined) image.expectedUrlPath = image.path ?? null;
          const check = validateWebsiteImageUrl(trimmed, {
            allowedHosts: this.productImageConfig.allowedImageHosts,
            maxLength: this.slotMaxLength(image.slot),
            asciiOnly: true,
          });
          image.urlValid = check.valid;
          image.normalizedUrl = check.url;
          image.invalid = !check.valid;
          image.error = check.valid ? '' : check.error;
        } else {
          image.urlPending = false;
          image.urlValid = false;
          image.normalizedUrl = '';
          image.expectedUrlPath = undefined;
        }
      } else {
        image.urlPending = false;
        image.urlValid = Boolean(original);
        image.normalizedUrl = original;
        image.expectedUrlPath = undefined;
      }
      this.persistDetailEdit();
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
      image.mode = 'upload';
      image.urlPending = false;
      image.urlInput = image.originalUrl ?? '';
      image.expectedUrlPath = undefined;
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
      const supportedType = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)
        || (!file.type && /\.avif$/i.test(file.name));
      if (!supportedType || file.size > 12 * 1024 * 1024) {
        image.invalid = true;
        image.error = 'เลือกรูป JPEG, PNG, WebP หรือ AVIF ขนาดไม่เกิน 12 MB';
        this.showToast?.(image.error, 'error', { announce: false });
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
        queueDraft(async () => { try { await imageDrafts.put(key, { file, expected }); } finally { this.imageDraftSaving--; } }, () => {
          this.imageDraftError = 'เก็บรูปชั่วคราวไม่ได้ รูปอาจหายเมื่อรีเฟรช';
          this.showToast?.(this.imageDraftError, 'error', { announce: false });
        });
      } else if (restoredExpected === undefined && !draftToken) {
        this.imageDraftError = 'เก็บรูปชั่วคราวไม่ได้ รูปอาจหายเมื่อรีเฟรช';
        this.showToast?.(this.imageDraftError, 'error', { announce: false });
      }
      const reader = new FileReader();
      reader.onload = () => { if (imageFiles.get(image.slot) === file && typeof reader.result === 'string') image.preview = reader.result; };
      reader.onerror = () => {
        if (imageFiles.get(image.slot) === file) {
          this.cancelImage(image);
          image.invalid = true;
          image.error = 'อ่านไฟล์รูปไม่ได้ กรุณาเลือกใหม่';
          this.showToast?.(image.error, 'error', { announce: false });
        }
      };
      reader.readAsDataURL(file);
    },
    async restoreImageDrafts() {
      if (!draftToken || !this.user?.username || !this.detailOpen) return;
      const id = this.selectedProduct.id;
      const username = this.user.username;
      try {
        await context.waitForDrafts();
        for (const image of this.imageSlots) {
          const draft = await imageDrafts.get(draftKey(username, id, image.slot));
          if (!this.detailOpen || this.selectedProduct.id !== id || this.user?.username !== username) return;
          if (draft?.file && !image.pending) { if (!this.editingDetail) this.startDetailEdit(); this.selectImageFile(draft.file, image, null, draft.expected ?? null); }
        }
      } catch {
        this.imageDraftError = 'โหลดรูปที่เลือกไว้ก่อนรีเฟรชไม่ได้';
        this.showToast?.(this.imageDraftError, 'error', { announce: false });
      }
    },
    cancelImages() {
      if (this.imageBusy) return;
      this.imageSlots.forEach((image) => this.cancelImage(image));
      this.imageSaveMessage = '';
      this.imageDraftError = '';
    },
    stageImageDelete(image) {
      if (!this.editingDetail || this.savingDetail) return;
      if (image.pending) this.cancelImage(image);
      image.urlPending = false;
      image.urlInput = image.originalUrl ?? '';
      image.expectedUrlPath = undefined;
      image.invalid = false;
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
            image.imageUrl = result.imageUrl ?? result.path;
            image.sourceType = 'upload';
            image.mode = 'upload';
            image.originalUrl = '';
            image.urlInput = '';
            image.urlPending = false;
            image.urlValid = false;
            image.normalizedUrl = '';
            image.url = adminApiUrl('product-image', { id: this.selectedProduct.id, slot: String(image.slot), v: Date.now().toString() });
            image.missing = false;
            this.catalogImageVersion++;
            succeeded.push(image.slot);
          } catch (error) {
            image.error = error.status === 409
              ? 'รูปนี้มีการเปลี่ยนแปลงแล้ว กรุณาปิดและเปิดรายละเอียดใหม่ก่อนลองอีกครั้ง'
              : error.message === 'image_url_too_long'
                ? `ลิงก์รูปหรือชื่อไฟล์ยาวเกินขนาดคอลัมน์ (สูงสุด ${this.slotMaxLength(image.slot).toLocaleString('th-TH')} ไบต์) กรุณาย่อชื่อไฟล์`
                : error.message === 'public_url_not_configured'
                  ? 'ระบบยังไม่ได้ตั้งค่าโดเมนสำหรับสร้างลิงก์รูปสินค้า (APP_PUBLIC_ORIGIN)'
                  : error.status === 413 || error.status === 422
                    ? 'รูปหรือรหัสสินค้าไม่ถูกต้อง ตรวจสอบขนาดไฟล์และความละเอียดของภาพ'
                    : 'อัปโหลดรูปไม่ได้ กรุณาลองอีกครั้งหรือติดต่อผู้ดูแลระบบ';
          }
        }
        if (succeeded.length && succeeded.length < pending.length) this.imageSaveMessage = `บันทึกรูปที่ ${succeeded.join(', ')} แล้ว กรุณาตรวจสอบรูปที่บันทึกไม่สำเร็จ`;
        if (!quiet && succeeded.length === pending.length) this.showImageToast('บันทึกรูปสินค้าแล้ว');
      } finally { this.imageSaving = false; this.imageBusy = false; }
    },
    // Saves pasted image links and staged deletions, adding each slot to the matching result list.
    async saveImageLinksAndDeletions(successes, failures) {
      for (const image of this.imageSlots.filter((item) => item.urlPending)) {
        image.error = '';
        try {
          const result = await request('save-product-image-url', {
            body: {
              id: this.selectedProduct.id,
              slot: image.slot,
              expected: image.expectedUrlPath ?? image.path ?? null,
              imageUrl: image.normalizedUrl || (image.urlInput ?? '').trim(),
            },
            csrf: this.csrf,
          });
          image.path = result.path;
          image.imageUrl = result.imageUrl ?? result.path;
          image.sourceType = 'url';
          image.mode = 'url';
          image.originalUrl = image.imageUrl;
          image.urlInput = image.imageUrl;
          image.normalizedUrl = image.imageUrl;
          image.urlValid = true;
          image.url = image.imageUrl;
          image.missing = false;
          image.urlPending = false;
          image.expectedUrlPath = undefined;
          image.invalid = false;
          image.error = '';
          this.catalogImageVersion++;
          successes.push(`รูปที่ ${image.slot}`);
        } catch (error) {
          image.error = error.status === 409
            ? 'รูปนี้มีการเปลี่ยนแปลงแล้ว กรุณาปิดและเปิดรายละเอียดใหม่ก่อนลองอีกครั้ง'
            : error.message === 'image_host_not_allowed'
              ? 'โดเมนของลิงก์ภาพไม่ได้อยู่ในรายการที่ผู้ดูแลอนุญาต'
              : error.message === 'image_url_too_long'
                ? `ลิงก์ภาพยาวเกินขนาดที่บันทึกได้ (สูงสุด ${this.slotMaxLength(image.slot).toLocaleString('th-TH')} ไบต์)`
                : error.message === 'invalid_image_url'
                  ? 'กรุณากรอกลิงก์ภาพ http:// หรือ https:// ที่ถูกต้อง'
                  : 'บันทึกลิงก์รูปไม่ได้ กรุณาลองอีกครั้งหรือติดต่อผู้ดูแลระบบ';
          failures.push(`รูปที่ ${image.slot}`);
        }
      }
      for (const image of this.imageSlots.filter((item) => item.deletePending)) {
        try {
          await request('delete-product-image', { body: { id: this.selectedProduct.id, slot: image.slot, expected: image.expectedDeletePath ?? image.path ?? null }, csrf: this.csrf });
          image.path = null; image.imageUrl = null; image.sourceType = null; image.mode = 'upload';
          image.originalUrl = ''; image.urlInput = ''; image.urlPending = false; image.urlValid = false; image.normalizedUrl = ''; image.urlPreviewFailed = false;
          image.url = ''; image.missing = true; image.deletePending = false; image.expectedDeletePath = undefined; image.error = '';
          this.catalogImageVersion++;
          successes.push(`รูปที่ ${image.slot}`);
        } catch (error) {
          image.error = error.status === 409 ? 'รูปนี้มีการเปลี่ยนแปลงแล้ว กรุณาปิดและเปิดรายละเอียดใหม่ก่อนลองอีกครั้ง' : 'ลบรูปไม่ได้ กรุณาลองอีกครั้งหรือติดต่อผู้ดูแลระบบ';
          failures.push(`รูปที่ ${image.slot}`);
        }
      }
    },
  };
}
