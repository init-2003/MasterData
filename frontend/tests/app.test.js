import { afterEach, expect, it, vi } from 'vitest';
import { createMasterData } from '../src/store/master-data.js';
import { createAppStore } from '../src/store/store.js';
import { createAuth } from '../src/store/auth.js';

vi.mock('../src/utils/dialog.js', () => ({ dialog: { fire: vi.fn() } }));
const drafts = vi.hoisted(() => new Map());
vi.mock('../src/services/image-drafts.js', () => ({ imageDrafts: {
  get: async (key) => drafts.get(key),
  put: async (key, value) => { drafts.set(key, value); },
  remove: async (key) => { drafts.delete(key); },
} }));
afterEach(() => vi.unstubAllGlobals());

it('restarts the toast timeout on repeated notifications and supports dismissal', () => {
  vi.useFakeTimers();
  try {
    const app = createMasterData();
    app.showImageToast('คัดลอกแล้ว');
    vi.advanceTimersByTime(3000);
    app.showImageToast('คัดลอกแล้ว');
    expect(app.imageToastVersion).toBe(2);
    vi.advanceTimersByTime(1500);
    expect(app.imageToast).toBe('คัดลอกแล้ว');
    app.dismissImageToast();
    expect(app.imageToast).toBe('');
    vi.advanceTimersByTime(4000);
    expect(app.imageToast).toBe('');
  } finally { vi.useRealTimers(); }
});

it('remembers only the username after successful login and forgets it when unchecked', async () => {
  const data = new Map();
  vi.stubGlobal('localStorage', { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) });
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'invalid_credentials' }), { status: 401 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ user: { username: 'operator' }, csrf: 'new', demo: true }))));
  const app = createAuth();
  Object.assign(app, { csrf: 'token', username: 'operator', password: 'wrong', restoreSidebarPreference() {}, loadTypes() {}, loadUnits() {}, loadProducts() {}, $nextTick() {} });
  app.setRememberUsername(true);
  await app.signIn();
  expect(data.size).toBe(0);
  app.password = 'correct';
  await app.signIn();
  expect(data.get('sptc.remembered-username')).toBe('operator');
  expect([...data.values()]).toEqual(['operator']);
  expect(createAuth()).toMatchObject({ username: 'operator', rememberUsername: true, password: '' });
  app.setRememberUsername(false);
  expect(data.size).toBe(0);
});

it('restores sidebar visibility per viewport after refresh', () => {
  const data = new Map();
  vi.stubGlobal('sessionStorage', { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) });
  vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
  const desktop = createMasterData();
  desktop.$nextTick = () => {};
  desktop.toggleSidebar();
  expect(createMasterData().sidebarOpen).toBe(false);
  vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
  const mobile = createMasterData();
  expect(mobile.sidebarOpen).toBe(false);
  mobile.$nextTick = () => {};
  mobile.toggleSidebar();
  expect(createMasterData().sidebarOpen).toBe(true);
  vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
  expect(createMasterData().sidebarOpen).toBe(false);
});

it('opens the desktop sidebar without blocking content and uses a modal menu on mobile', () => {
  vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
  const desktop = createMasterData();
  expect(desktop.sidebarOpen).toBe(true);
  expect(desktop.backgroundInert).toBe(false);
  expect(desktop.sidebarRole).toBeNull();
  desktop.$nextTick = () => {};
  desktop.toggleSidebar();
  expect(desktop.sidebarOpen).toBe(false);
  vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
  const mobile = createMasterData();
  expect(mobile.sidebarOpen).toBe(false);
  mobile.$nextTick = () => {};
  mobile.toggleSidebar();
  expect(mobile.sidebarRole).toBe('dialog');
  expect(mobile.backgroundInert).toBe(true);
});

it('keeps keyboard focus within the sidebar after removing its account controls', () => {
  const close = { focus: vi.fn() };
  const link = { focus: vi.fn() };
  vi.stubGlobal('document', { activeElement: link });
  const app = createMasterData();
  app.isCompact = true;
  app.sidebarOpen = true;
  app.$refs = { sidebarClose: close, catalogLink: link };
  const event = { shiftKey: false, preventDefault: vi.fn() };
  app.handleSidebarTab(event);
  expect(event.preventDefault).toHaveBeenCalledOnce();
  expect(close.focus).toHaveBeenCalledOnce();
});

it('restores edit fields and staged image deletion with their original conflict values', async () => {
  vi.stubGlobal('window', { matchMedia: () => ({ addEventListener() {}, removeEventListener() {} }) });
  const storage = new Map();
  vi.stubGlobal('sessionStorage', { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) });
  const first = createMasterData();
  first.user = { username: 'demo' };
  first.detailOpen = true;
  first.selectedProduct = { id: 'P1', price: '12.00' };
  first.note = 'เดิม'; first.shortNote = 'ย่อเดิม';
  first.imageSlots = [{ slot: 1, path: 'P1/old.png', missing: false }];
  first.startDetailEdit();
  first.priceInput = '15.00'; first.noteInput = 'ใหม่'; first.shortNoteInput = 'ย่อใหม่';
  first.stageImageDelete(first.imageSlots[0]);

  const restored = createMasterData();
  restored.user = { username: 'demo' };
  restored.detailOpen = true;
  restored.selectedProduct = { id: 'P1', price: '13.00' };
  restored.note = 'เปลี่ยนจากที่อื่น'; restored.shortNote = 'เปลี่ยนจากที่อื่น';
  restored.imageSlots = [{ slot: 1, path: 'P1/new.png', missing: false }];
  restored.restoreDetailEdit();
  expect(restored.editingDetail).toBe(true);
  expect([restored.priceInput, restored.noteInput, restored.shortNoteInput]).toEqual(['15.00', 'ใหม่', 'ย่อใหม่']);
  expect([restored.selectedProduct.price, restored.note, restored.shortNote]).toEqual(['12.00', 'เดิม', 'ย่อเดิม']);
  expect(restored.imageSlots[0]).toMatchObject({ deletePending: true, expectedDeletePath: 'P1/old.png' });
});

it('combines authentication and product state without freezing reactive getters', async () => {
  vi.stubGlobal('window', { matchMedia: () => ({ addEventListener() {}, removeEventListener() {} }) });
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [], page: 1, pageSize: 15, total: 0, totalPages: 1 })));
  vi.stubGlobal('fetch', fetch);
  const app = createMasterData();
  app.booting = false;
  expect(app.showLogin).toBe(true);
  app.applySession({ user: { username: 'demo' }, csrf: 'token', demo: true });
  expect(app.showCatalog).toBe(true);
  expect(app.accountName).toBe('demo');
  app.togglePassword();
  expect(app.passwordType).toBe('text');
  app.selectedType = 'กระเบื้อง';
  app.selectedUnit = 'กล่อง';
  app.searchInput = ' สินค้า ';
  await app.submitSearch();
  const url = new URL(fetch.mock.calls[0][0], 'http://localhost');
  expect(url.searchParams.get('q')).toBe('สินค้า');
  expect(url.searchParams.get('type')).toBe('กระเบื้อง');
  expect(url.searchParams.get('unit')).toBe('กล่อง');
  expect(app.showEmpty).toBe(true);
  app.clearCatalog();
  expect(app.selectedType).toBe('');
  expect(app.selectedUnit).toBe('');
});

it('notifies React when top-level and nested product state change', () => {
  vi.stubGlobal('window', { matchMedia: () => ({ addEventListener() {}, removeEventListener() {} }) });
  const store = createAppStore();
  const listener = vi.fn();
  const unsubscribe = store.subscribe(listener);
  store.app.booting = false;
  store.app.imageSlots = [{ slot: 1, preview: '' }];
  store.app.imageSlots[0].preview = 'data:image/png;base64,example';
  expect(listener).toHaveBeenCalledTimes(3);
  expect(store.snapshot()).toBe(3);
  unsubscribe();
});

it('loads and saves a short note with the original value for conflict detection', async () => {
  vi.stubGlobal('window', { matchMedia: () => ({ addEventListener() {}, removeEventListener() {} }) });
  const fetch = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ note: 'เดิม' })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
  vi.stubGlobal('fetch', fetch);
  const app = createMasterData();
  app.selectedProduct = { id: 'P1' };
  app.csrf = 'token';
  await app.loadShortNote();
  expect(app.shortNoteInput).toBe('เดิม');
  app.editingShortNote = true;
  app.shortNoteInput = 'ใหม่';
  await app.saveShortNote();
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ id: 'P1', expectedNote: 'เดิม', note: 'ใหม่' });
  expect(app.shortNote).toBe('ใหม่');
  expect(app.editingShortNote).toBe(false);
});

it('saves both selected images and retains a failed image for retry', async () => {
  vi.stubGlobal('window', { matchMedia: () => ({ addEventListener() {}, removeEventListener() {} }) });
  vi.stubGlobal('FileReader', class { readAsDataURL() { this.result = 'data:image/png;base64,AA'; this.onload(); } });
  const fetch = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ path: 'P1/one.png' })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'failed' }), { status: 500 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ path: 'P1/two.png' })));
  vi.stubGlobal('fetch', fetch);
  const app = createMasterData();
  app.selectedProduct = { id: 'P1' };
  app.csrf = 'token';
  app.imageSlots = [{ slot: 1, path: null, missing: true }, { slot: 2, path: null, missing: true }];
  for (const image of app.imageSlots) app.selectImage({ target: { files: [new File(['test'], 'image.png', { type: 'image/png' })], value: 'image.png' } }, image);
  await app.uploadImages();
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(app.imageSlots[0].path).toBe('P1/one.png');
  expect(app.imageSlots[0].pending).toBe(false);
  expect(app.imageSlots[1].pending).toBe(true);
  expect(app.imageSlots[1].error).toContain('อัปโหลดรูปไม่ได้');
  expect(app.imageSaveMessage).toContain('รูปที่ 1');
  await app.uploadImages();
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(app.imageSlots[1].path).toBe('P1/two.png');
  expect(app.imageSlots[1].pending).toBe(false);
  expect(app.imageToast).toBe('บันทึกรูปสินค้าแล้ว');
});

it('validates dropped images and allows cancelling a selected file', () => {
  vi.stubGlobal('window', { matchMedia: () => ({ addEventListener() {}, removeEventListener() {} }) });
  vi.stubGlobal('FileReader', class { readAsDataURL() { this.result = 'data:image/png;base64,AA'; this.onload(); } });
  const app = createMasterData();
  const image = { slot: 1, path: null, missing: true };
  app.imageSlots = [image];
  app.selectImageFile(new File(['bad'], 'bad.txt', { type: 'text/plain' }), image);
  expect(image.invalid).toBe(true);
  expect(image.error).toContain('JPEG');
  app.selectImageFile(new File(['test'], 'image.png', { type: 'image/png' }), image);
  expect(image.pending).toBe(true);
  expect(image.preview).toContain('data:image/png');
  app.cancelImages();
  expect(image.pending).toBe(false);
  expect(image.preview).toBe('');
});

it('restores an open product using fresh data for the same user', async () => {
  vi.stubGlobal('window', { matchMedia: () => ({ addEventListener() {}, removeEventListener() {} }) });
  vi.stubGlobal('document', { activeElement: null });
  const saved = JSON.stringify({ id: 'P1', code: 'P1', username: 'demo' });
  vi.stubGlobal('sessionStorage', { getItem: () => saved, setItem: vi.fn(), removeItem: vi.fn() });
  const fresh = { id: 'P1', code: 'P1', name: 'ชื่อใหม่', price: '12.00' };
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [fresh], totalPages: 1 })));
  vi.stubGlobal('fetch', fetch);
  const app = createMasterData();
  app.user = { username: 'demo' };
  app.$nextTick = () => {};
  app.loadImages = vi.fn();
  app.loadNote = vi.fn();
  app.loadShortNote = vi.fn();
  await app.restoreProduct();
  expect(app.detailOpen).toBe(true);
  expect(app.selectedProduct).toEqual(fresh);
  expect(app.loadImages).toHaveBeenCalledOnce();
});

it('restores a pending image after reload and removes it on cancellation', async () => {
  vi.stubGlobal('window', { matchMedia: () => ({ addEventListener() {}, removeEventListener() {} }) });
  vi.stubGlobal('sessionStorage', { getItem: () => 'tab-1', setItem: vi.fn(), removeItem: vi.fn() });
  vi.stubGlobal('FileReader', class { readAsDataURL() { this.result = 'data:image/png;base64,AA'; this.onload(); } });
  const first = createMasterData();
  first.user = { username: 'demo' };
  first.selectedProduct = { id: 'P1' };
  first.detailOpen = true;
  first.imageSlots = [{ slot: 1, path: 'old.png', missing: false }];
  first.selectImageFile(new File(['test'], 'new.png', { type: 'image/png' }), first.imageSlots[0]);
  await vi.waitFor(() => expect(first.imageDraftSaving).toBe(0));
  const refreshed = createMasterData();
  refreshed.user = { username: 'demo' };
  refreshed.selectedProduct = { id: 'P1' };
  refreshed.detailOpen = true;
  refreshed.imageSlots = [{ slot: 1, path: 'changed.png', missing: false }];
  await refreshed.restoreImageDrafts();
  expect(refreshed.imageSlots[0].pending).toBe(true);
  expect(refreshed.imageSlots[0].expectedPath).toBe('old.png');
  refreshed.cancelImages();
  await vi.waitFor(() => expect(drafts.size).toBe(0));
});

it('saves changed fields together and retains failed changes for retry', async () => {
  vi.stubGlobal('window', { matchMedia: () => ({ addEventListener() {}, removeEventListener() {} }) });
  const fetch = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'note_changed' }), { status: 409 }));
  vi.stubGlobal('fetch', fetch);
  const app = createMasterData();
  app.selectedProduct = { id: 'P1', price: '10.00' };
  app.csrf = 'token';
  app.note = 'เดิม';
  app.shortNote = null;
  app.loadProducts = vi.fn();
  app.startDetailEdit();
  app.priceInput = '12.00';
  app.noteInput = 'ใหม่';
  await app.saveDetail();
  expect(app.selectedProduct.price).toBe('12.00');
  expect(app.originalPriceInput).toBe('12.00');
  expect(app.noteInput).toBe('ใหม่');
  expect(app.note).toBe('เดิม');
  expect(app.editingDetail).toBe(true);
  expect(app.detailSaveError).toContain('ราคาขาย');
  expect(app.detailSaveError).toContain('คำอธิบายสินค้า');
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('stages image deletion until saving and rejects invalid price before requests', async () => {
  vi.stubGlobal('window', { matchMedia: () => ({ addEventListener() {}, removeEventListener() {} }) });
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
  vi.stubGlobal('fetch', fetch);
  const app = createMasterData();
  app.selectedProduct = { id: 'P1', price: '10.00' };
  app.imageSlots = [{ slot: 1, path: 'P1/one.png', missing: false }];
  app.startDetailEdit();
  app.stageImageDelete(app.imageSlots[0]);
  expect(app.imageSlots[0].deletePending).toBe(true);
  expect(fetch).not.toHaveBeenCalled();
  app.priceInput = 'invalid';
  await app.saveDetail();
  expect(fetch).not.toHaveBeenCalled();
  expect(app.priceError).toBeTruthy();
  app.priceInput = '10.00';
  await app.saveDetail();
  expect(fetch).toHaveBeenCalledOnce();
  expect(app.imageSlots[0].path).toBeNull();
  expect(app.editingDetail).toBe(false);
});

it('shows error and success toasts for login, logout, and session expiration', async () => {
  vi.stubGlobal('window', { matchMedia: () => ({ addEventListener() {}, removeEventListener() {} }) });
  const fetch = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'invalid_credentials' }), { status: 401 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ user: { username: 'operator' }, csrf: 'new', demo: false })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ user: null, csrf: 'logged-out', demo: false })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 }));
  vi.stubGlobal('fetch', fetch);
  const app = createMasterData();
  Object.assign(app, { csrf: 'token', username: 'operator', password: 'wrong', loadTypes() {}, loadUnits() {}, loadProducts: vi.fn(), $nextTick() {} });
  await app.signIn();
  expect(app.imageToastType).toBe('error');
  expect(app.imageToast).toBe(app.loginError);
  app.password = 'correct';
  await app.signIn();
  expect(app.imageToastType).toBe('success');
  expect(app.imageToast).toBe('เข้าสู่ระบบแล้ว');
  await app.signOut();
  expect(app.imageToastType).toBe('success');
  expect(app.imageToast).toBe('ออกจากระบบแล้ว');
  const sessionApp = createMasterData();
  sessionApp.user = { username: 'operator' };
  await sessionApp.loadProducts(1);
  expect(sessionApp.user).toBeNull();
  expect(sessionApp.imageToastType).toBe('error');
  expect(sessionApp.imageToast).toBe('เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง');
});

it('shows error toast when detail validation or saving fails', async () => {
  vi.stubGlobal('window', { matchMedia: () => ({ addEventListener() {}, removeEventListener() {} }) });
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'failed' }), { status: 500 }));
  vi.stubGlobal('fetch', fetch);
  const app = createMasterData();
  app.selectedProduct = { id: 'P1', price: '10.00' };
  app.csrf = 'token';
  app.startDetailEdit();
  app.priceInput = 'bad';
  await app.saveDetail();
  expect(app.imageToastType).toBe('error');
  expect(app.imageToast).toBe(app.detailSaveError);
  app.priceInput = '12.00';
  await app.saveDetail();
  expect(app.imageToastType).toBe('error');
  expect(app.imageToast).toBe('บันทึกข้อมูลบางส่วนไม่สำเร็จ กรุณาตรวจสอบ');
});
