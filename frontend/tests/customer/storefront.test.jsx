import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { CarouselSection } from '../../customer/src/components/CarouselSection.jsx';
import { ProductDetailModal } from '../../customer/src/components/ProductDetailModal.jsx';

it('renders active storefront slides and customer product details with no-referrer images', () => {
  const carousel = renderToStaticMarkup(
    <CarouselSection slides={[
      { id: '1', title: 'โปรเปิดร้าน', imageUrl: './website-images/carousel/hero.jpg' },
      { id: '2', title: 'ลดพิเศษ', imageUrl: 'https://cdn.example.com/sale.webp' },
    ]} />
  );
  expect(carousel).toContain('โปรเปิดร้าน');
  expect(carousel).toContain('./website-images/carousel/hero.jpg');
  expect(carousel).toContain('สไลด์ถัดไป');

  const detail = renderToStaticMarkup(
    <ProductDetailModal
      item={{
        id: '1',
        code: 'SP-0001',
        name: 'กระเบื้องพอร์ซเลน',
        category: 'กระเบื้อง',
        unit: 'กล่อง',
        price: '329.00',
        shortNote: 'ลายหินอ่อน',
        note: 'รายละเอียดเต็ม',
        images: ['./product-images/SP-0001/tile.jpg'],
      }}
      loading={false}
      error={false}
      onClose={() => {}}
      onRetry={() => {}}
    />
  );
  expect(detail).toContain('SP-0001');
  expect(detail).toContain('กระเบื้องพอร์ซเลน');
  expect(detail).toContain('ลายหินอ่อน');
  expect(detail).toContain('referrerPolicy="no-referrer"');
});
