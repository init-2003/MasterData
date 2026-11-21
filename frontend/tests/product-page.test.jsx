import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { ProductPage } from '../src/pages/ProductPage.jsx';

afterEach(() => vi.unstubAllGlobals());

it('requests product images only when the saved display preference is enabled', () => {
  const app = {
    items: [{ id: 'A&B', code: 'A&B', name: 'สินค้า', category: '', unit: '', price: null }],
    types: [], units: [], selectedType: '', selectedUnit: '', searchInput: '',
    display: (value) => value || '—', price: () => '—', detailLabel: () => 'ดูรายละเอียด',
    catalogImageVersion: 123, $refs: {},
  };
  vi.stubGlobal('sessionStorage', { getItem: () => null });
  const hidden = renderToStaticMarkup(<ProductPage app={app} />);
  expect(hidden).toContain('แสดงรูปสินค้า');
  expect(hidden).not.toContain('action=product-image');
  vi.stubGlobal('sessionStorage', { getItem: () => 'true' });
  const shown = renderToStaticMarkup(<ProductPage app={app} />);
  expect(shown).toContain('action=product-image&amp;id=A%26B&amp;slot=1&amp;v=123');
  expect(shown).toContain('checked=""');
});

it('restores grid view with the same product, price and detail action', () => {
  vi.stubGlobal('sessionStorage', { getItem: (key) => key === 'sptc.product-view' ? 'grid' : null });
  const app = {
    items: [{ id: 'P1', code: 'P1', name: 'สินค้าไทย', price: '12' }],
    types: [], units: [], selectedType: '', selectedUnit: '', searchInput: '',
    display: (value) => value || '—', price: (value) => `${value} บาท`, detailLabel: () => 'ดูรายละเอียด สินค้าไทย',
    catalogImageVersion: 1, $refs: {},
  };
  const markup = renderToStaticMarkup(<ProductPage app={app} />);
  expect(markup).toContain('class="product-grid"');
  expect(markup).toContain('สินค้าไทย');
  expect(markup).toContain('12 บาท');
  expect(markup).toContain('data-product-id="P1"');
  expect(markup).toContain('action=product-image&amp;id=P1');
  expect(markup).not.toContain('class="product-table"');
});
