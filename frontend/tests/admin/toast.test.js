import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createToast } from '../../admin/src/store/toast.js';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it('closes success messages after four seconds and keeps errors until closed', () => {
  const toast = createToast();
  toast.showImageToast('ลบภาพแล้ว');
  vi.advanceTimersByTime(3999);
  expect(toast.imageToast).toBe('ลบภาพแล้ว');
  vi.advanceTimersByTime(1);
  expect(toast.imageToast).toBe('');

  toast.showImageToast('ลบภาพไม่สำเร็จ กรุณาลองอีกครั้ง', 'error');
  vi.advanceTimersByTime(60_000);
  expect(toast.imageToast).toBe('ลบภาพไม่สำเร็จ กรุณาลองอีกครั้ง');
  toast.dismissToast();
  expect(toast.imageToast).toBe('');
});

it('lets a newer message replace an error and gives it its own timer', () => {
  const toast = createToast();
  toast.showToast('ออกจากระบบไม่สำเร็จ', 'error');
  toast.showToast('บันทึกภาพแล้ว');
  expect(toast.imageToastType).toBe('success');
  vi.advanceTimersByTime(4000);
  expect(toast.imageToast).toBe('');

  toast.showToast('เพิ่มภาพแล้ว');
  toast.showToast('บันทึกลำดับไม่สำเร็จ', 'error');
  vi.advanceTimersByTime(10_000);
  expect(toast.imageToast).toBe('บันทึกลำดับไม่สำเร็จ');
});

it('closes only the matching error on retry and can stay silent for screen readers', () => {
  const toast = createToast();
  toast.showToast('โหลดหน่วยสินค้าไม่ได้', 'error', { announce: false });
  expect(toast.imageToastAnnounce).toBe(false);
  toast.dismissToastMessage('ข้อความอื่น');
  toast.dismissToastMessage('');
  expect(toast.imageToast).toBe('โหลดหน่วยสินค้าไม่ได้');
  toast.dismissToastMessage('โหลดหน่วยสินค้าไม่ได้');
  expect(toast.imageToast).toBe('');

  toast.showImageToast('คัดลอกรหัสสินค้าไม่ได้', 'error');
  expect(toast.imageToastAnnounce).toBe(true);
});
