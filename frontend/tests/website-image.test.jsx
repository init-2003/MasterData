import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { validateWebsiteImageUrl } from '../src/utils/website-image-url.js';
import { newWebsiteImageDraft, readWebsiteImageDraft, saveWebsiteImageDraft } from '../src/services/website-image-drafts.js';
import { WebsiteImageEditor } from '../src/components/WebsiteImageEditor.jsx';
import { WebsiteImagePreview } from '../src/components/WebsiteImagePreview.jsx';

vi.mock('../src/utils/dialog.js', () => ({ dialog: { fire: vi.fn() } }));
vi.mock('../src/services/image-drafts.js', () => ({
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

  const urlDraft = newWebsiteImageDraft({
    id: '2',
    title: 'โปรโมชันหน้าร้อน',
    active: false,
    sourceType: 'url',
    imageUrl: 'https://cdn.example.com/summer.jpg',
    preview: 'https://cdn.example.com/summer.jpg',
  });
  const urlEditor = renderToStaticMarkup(
    <WebsiteImageEditor
      open
      draft={urlDraft}
      username="operator"
      menu={{ id: 'promo-banner', title: 'ภาพแบนเนอร์โปรโมชัน' }}
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
  expect(urlEditor).toContain('https://cdn.example.com/summer.jpg');
  expect(urlEditor).toContain('cdn.example.com');
  expect(urlEditor).toContain('maxLength="255"');

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
      menu={{ id: 'promo-banner', title: 'ภาพแบนเนอร์โปรโมชัน' }}
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
