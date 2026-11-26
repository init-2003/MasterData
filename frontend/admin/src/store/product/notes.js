import { request } from '../../services/api.js';

// Full and short product descriptions.
export function createNotes(context) {
  return {
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
    async loadNote() {
      context.requests.note?.abort();
      const controller = new AbortController();
      context.requests.note = controller;
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
        if (context.requests.note === controller) { this.noteLoading = false; context.requests.note = undefined; }
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
      context.requests.shortNote?.abort();
      const controller = new AbortController();
      context.requests.shortNote = controller;
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
        if (context.requests.shortNote === controller) { this.shortNoteLoading = false; context.requests.shortNote = undefined; }
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
  };
}
