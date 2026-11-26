import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { validateWebsiteImageUrl } from '../../admin/src/utils/website-image-url.js';
import { newWebsiteImageDraft, readWebsiteImageDraft, saveWebsiteImageDraft } from '../../admin/src/services/website-image-drafts.js';
import { WebsiteImageEditor } from '../../admin/src/components/WebsiteImageEditor.jsx';
import { WebsiteImagePreview } from '../../admin/src/components/WebsiteImagePreview.jsx';

vi.mock('../../admin/src/utils/dialog.js', () => ({ dialog: { fire: vi.fn() } }));
vi.mock('../../admin/src/services/image-drafts.js', () => ({
  imageDrafts: {
    get: async () => undefined,
    put: async () => {},
    remove: async () => {},
  },
}));

afterEach(() => vi.unstubAllGlobals());

it('validates external HTTPS image URLs against allowed hosts and column length', () => {
  const options = { allowedHosts: ['cdn.example.com', 'images.example.com'], maxLength: 60 };
  expect(validateWebsiteImageUrl('https://CDN.Example.com/promo/a.webp?w=800', options)).toEqual({
    valid: true,
    url: 'https://cdn.example.com/promo/a.webp?w=800',
    error: '',
  });
  expect(validateWebsiteImageUrl('http://cdn.example.com/promo/a.webp', options)).toEqual({
    valid: true,
    url: 'http://cdn.example.com/promo/a.webp',
    error: '',
  });
  expect(validateWebsiteImageUrl('data:image/png;base64,AAAA', options).valid).toBe(false);
  expect(validateWebsiteImageUrl('javascript:alert(1)', options).valid).toBe(false);
  expect(validateWebsiteImageUrl('https://other.example.com/promo/a.webp', options)).toMatchObject({
    valid: false,
    error: expect.stringContaining('โดเมน'),
  });
  expect(validateWebsiteImageUrl('https://cdn.example.com/' + 'a'.repeat(50), options)).toMatchObject({
    valid: false,
    error: expect.stringContaining('ยาวเกิน'),
  });
  expect(validateWebsiteImageUrl('https://any-cdn.example.org/promo/a.webp', { allowedHosts: [], maxLength: 500 })).toEqual({
    valid: true,
    url: 'https://any-cdn.example.org/promo/a.webp',
    error: '',
  });
  expect(validateWebsiteImageUrl('http://127.0.0.1:8094/api.php?website-image=promo-banner/test.png', { allowedHosts: [], maxLength: 500 })).toEqual({
    valid: true,
    url: 'http://127.0.0.1:8094/api.php?website-image=promo-banner/test.png',
    error: '',
  });
  expect(validateWebsiteImageUrl('http://localhost:8094/promo/a.webp', { allowedHosts: [], maxLength: 500 })).toEqual({
    valid: true,
    url: 'http://localhost:8094/promo/a.webp',
    error: '',
  });
});

it('persists mode and imageUrl in website image drafts and remains backward compatible', () => {
  const storage = new Map();
  vi.stubGlobal('sessionStorage', {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  });
  const urlDraft = newWebsiteImageDraft({
    id: '5',
    title: 'สไลด์ลิงก์',
    active: true,
    sourceType: 'url',
    imageUrl: 'https://cdn.example.com/slide.jpg',
  });
  expect(urlDraft.fields).toEqual({
    title: 'สไลด์ลิงก์',
    active: true,
    mode: 'url',
    imageUrl: 'https://cdn.example.com/slide.jpg',
  });
  expect(saveWebsiteImageDraft('operator', 'carousel', urlDraft)).toBe(true);
  expect(readWebsiteImageDraft('operator', 'carousel')).toEqual(urlDraft);

  // Backward-compatible draft without mode / imageUrl
  storage.set(JSON.stringify(['sptc.website-image-editor', 'operator', 'promo-banner']), JSON.stringify({
    token: 'abc',
    item: { active: false },
    fields: { title: 'เดิม', active: false },
    fileName: null,
  }));
  expect(readWebsiteImageDraft('operator', 'promo-banner')?.fields).toEqual({
    title: 'เดิม',
    active: false,
    mode: 'upload',
    imageUrl: '',
  });
});

it('renders both upload and URL modes in WebsiteImageEditor and sets no-referrer on external previews', () => {
  const externalMarkup = renderToStaticMarkup(
    <WebsiteImagePreview src="https://cdn.example.com/banner.jpg" alt="แบนเนอร์" />
  );
  expect(externalMarkup).toContain('referrerPolicy="no-referrer"');

  const longImageUrl = `https://cdn.example.com/summer.jpg?context=${'a'.repeat(250)}`;
  const urlDraft = newWebsiteImageDraft({
    id: '2',
    title: 'โปรโมชันหน้าร้อน',
    active: false,
    sourceType: 'url',
    imageUrl: longImageUrl,
    preview: longImageUrl,
  });
  const urlEditor = renderToStaticMarkup(
    <WebsiteImageEditor
      open
      draft={urlDraft}
      username="operator"
      menu={{ id: 'promo-banner', title: 'แบนเนอร์ต้อนรับ' }}
      config={{ uploadEnabled: true, allowedImageHosts: ['cdn.example.com'], maxImageUrlLength: 255 }}
      metadataSaved
      saving={false}
      error=""
      onSave={() => {}}
      onClose={() => {}}
    />
  );
  expect(urlEditor).toContain('อัปโหลดไฟล์');
  expect(urlEditor).toContain('ใส่ลิงก์ภาพ');
  expect(urlEditor).toContain('name="imageUrl"');
  expect(urlEditor).toContain(`value="${longImageUrl}"`);
  expect(urlEditor).toContain('cdn.example.com');
  expect(urlEditor).not.toMatch(/<input[^>]*name="imageUrl"[^>]*maxlength=/i);
  expect(urlEditor).toContain('ลิงก์ภาพยาวเกินขนาดที่บันทึกได้ (สูงสุด 255 ตัวอักษร)');

  const uploadDraft = newWebsiteImageDraft({
    id: '3',
    title: 'ภาพอัปโหลด',
    active: true,
    sourceType: 'upload',
    imageUrl: 'https://assets.example.com/master-data/api.php?website-image=promo-banner/hero.jpg',
    preview: './api.php?action=website-image&collection=promo-banner&id=3&version=abc',
  });
  const uploadEditor = renderToStaticMarkup(
    <WebsiteImageEditor
      open
      draft={uploadDraft}
      username="operator"
      menu={{ id: 'promo-banner', title: 'แบนเนอร์ต้อนรับ' }}
      config={{ uploadEnabled: true, allowedImageHosts: ['cdn.example.com'], maxImageUrlLength: 255 }}
      metadataSaved
      saving={false}
      error=""
      onSave={() => {}}
      onClose={() => {}}
    />
  );
  expect(uploadEditor).toContain('name="image"');
  expect(uploadEditor).toContain('ลิงก์ภาพปัจจุบัน');
  expect(uploadEditor).toContain('คัดลอกลิงก์ภาพปัจจุบัน');
  expect(uploadEditor).toContain('https://assets.example.com/master-data/api.php?website-image=promo-banner/hero.jpg');
});

it('adds the customer-level promotion menu with a level picker and an optional description', async () => {
  const { websiteImageMenus, promotionLevelMenu } = await import('../../admin/src/routes/website-image-menus.js');
  expect(websiteImageMenus.map(({ id }) => id)).toContain('promotion-level');
  expect(promotionLevelMenu).toMatchObject({ id: 'promotion-level', title: 'โปรโมชันตามระดับ', levels: true });

  const config = {
    uploadEnabled: true, allowedImageHosts: [], maxImageUrlLength: 500, titleRequired: false,
    levels: [{ code: '1', name: 'ขายปลีก' }, { code: '2', name: 'ขายส่ง 1' }],
  };
  const render = (item) => renderToStaticMarkup(
    <WebsiteImageEditor open draft={newWebsiteImageDraft(item)} username="operator" menu={promotionLevelMenu}
      config={config} metadataSaved saving={false} error="" onSave={() => {}} onClose={() => {}} />
  );

  const existing = render({ id: '9', title: '', active: false, sourceType: 'upload', level: '2', levelName: 'ขายส่ง1', preview: '/admin/website-image?id=9' });
  expect(existing).toContain('ระดับลูกค้า');
  expect(existing).toContain('name="level" value="2"');
  expect(existing).toContain('aria-label="ระดับลูกค้า: ขายส่ง 1"');
  expect(existing).toContain('คำอธิบาย (ไม่บังคับ)');
  expect(existing.match(/<input[^>]*name="title"[^>]*>/)[0]).not.toContain("required");

  // A level no longer found in dbo.Customer stays visible and is marked.
  const orphan = render({ id: '10', title: 'เก่า', active: true, sourceType: 'upload', level: '9', levelName: 'ยกเลิกแล้ว' });
  expect(orphan).toContain('ยกเลิกแล้ว (ไม่พบในข้อมูลลูกค้า)');

  const added = render({ active: false });
  expect(added).toContain('name="level" value=""');
  expect(added).toContain('aria-label="ระดับลูกค้า: เลือกระดับลูกค้า"');

  // Other menus keep a required title and no level field.
  const banner = renderToStaticMarkup(
    <WebsiteImageEditor open draft={newWebsiteImageDraft({ active: false })} username="operator"
      menu={{ id: 'promo-banner', title: 'แบนเนอร์ต้อนรับ' }}
      config={{ uploadEnabled: true, allowedImageHosts: [], maxImageUrlLength: 255 }}
      metadataSaved saving={false} error="" onSave={() => {}} onClose={() => {}} />
  );
  expect(banner).not.toContain('name="level"');
  expect(banner.match(/<input[^>]*name="title"[^>]*>/)[0]).toContain("required");
});

it('keeps the chosen customer level in website image drafts', () => {
  const storage = new Map();
  vi.stubGlobal('sessionStorage', {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  });
  const draft = newWebsiteImageDraft({ id: '9', title: '', active: true, sourceType: 'upload', level: '3' });
  expect(draft.fields).toEqual({ title: '', active: true, mode: 'upload', imageUrl: '', level: '3' });
  const changed = { ...draft, fields: { ...draft.fields, level: '2' } };
  expect(saveWebsiteImageDraft('operator', 'promotion-level', changed)).toBe(true);
  expect(readWebsiteImageDraft('operator', 'promotion-level').fields.level).toBe('2');
  expect(newWebsiteImageDraft({ active: false }).fields).not.toHaveProperty('level');
});
