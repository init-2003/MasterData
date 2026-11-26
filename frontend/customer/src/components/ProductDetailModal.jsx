import React, { useEffect, useRef, useState } from 'react';
import { ImageOff, X } from 'lucide-react';
import { display, price } from '../../../shared/utils/format.js';

export function ProductDetailModal({ item, loading, error, onClose, onRetry }) {
  const [selectedImage, setSelectedImage] = useState(0);
  const headingRef = useRef(null);

  useEffect(() => {
    setSelectedImage(0);
  }, [item?.id]);

  useEffect(() => {
    if (!item && !loading && !error) return undefined;
    headingRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [item, loading, error, onClose]);

  if (!item && !loading && !error) return null;
  const images = item?.images ?? [];
  const activeSrc = images[selectedImage] ?? images[0] ?? '';

  return <>
    <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />
    <aside className="drawer-panel" role="dialog" aria-modal="true" aria-labelledby="customer-product-heading">
      <header className="drawer-header">
        <h2 id="customer-product-heading" tabIndex={-1} ref={headingRef}>รายละเอียดสินค้า</h2>
        <button type="button" className="icon-button" onClick={onClose} aria-label="ปิดรายละเอียดสินค้า">
          <X aria-hidden="true" />
        </button>
      </header>
      <div className="drawer-body">
        {loading && <div className="store-loading" aria-busy="true"><span className="loading-spinner" aria-hidden="true" /></div>}
        {error && <div className="store-alert" role="alert">
          โหลดรายละเอียดสินค้าไม่สำเร็จ <button type="button" onClick={onRetry}>ลองอีกครั้ง</button>
        </div>}
        {item && !loading && !error && <>
          <div className="detail-gallery">
            <div className="detail-main-image">
              {activeSrc
                ? <img src={activeSrc} alt={display(item.name)} referrerPolicy="no-referrer" />
                : <span className="image-empty"><ImageOff aria-hidden="true" /><span>ยังไม่มีรูปสินค้า</span></span>}
            </div>
            {images.length > 1 && <div className="detail-thumbs">
              {images.map((src, idx) => (
                <button key={src} type="button" className={idx === selectedImage ? 'is-active' : undefined}
                  onClick={() => setSelectedImage(idx)} aria-label={`ดูรูปที่ ${idx + 1}`}>
                  <img src={src} alt="" referrerPolicy="no-referrer" />
                </button>
              ))}
            </div>}
          </div>
          <p className="detail-code">{display(item.code)}</p>
          <h3 className="detail-title">{display(item.name)}</h3>
          <p className="detail-price">{price(item.price)}</p>
          <dl className="detail-meta">
            <div><dt>ประเภท</dt><dd>{display(item.category)}</dd></div>
            <div><dt>หน่วย</dt><dd>{display(item.unit)}</dd></div>
          </dl>
          {item.shortNote && <section className="detail-note">
            <h4>รายละเอียดโดยย่อ</h4>
            <p>{item.shortNote}</p>
          </section>}
          {item.note && <section className="detail-note">
            <h4>รายละเอียดสินค้า</h4>
            <p>{item.note}</p>
          </section>}
        </>}
      </div>
    </aside>
  </>;
}
