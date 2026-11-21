import React, { useEffect, useState } from 'react';
import { Copy, Image as ImageIcon, RotateCcw, Trash2, Upload, X } from 'lucide-react';

export function ProductDetail({ app }) {
  const [exiting, setExiting] = useState(false);
  const [dragSlot, setDragSlot] = useState(null);
  const copyCode = async () => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(app.selectedProduct.code);
      else {
        const input = document.createElement('textarea');
        input.value = app.selectedProduct.code;
        input.style.cssText = 'position:fixed;left:-9999px;top:0';
        const focused = document.activeElement;
        document.body.appendChild(input);
        input.select();
        let copied;
        try { copied = document.execCommand('copy'); } finally { input.remove(); focused?.focus(); }
        if (!copied) throw new Error('Clipboard unavailable');
      }
      app.showImageToast('คัดลอกรหัสสินค้าแล้ว');
    } catch { app.showImageToast('คัดลอกรหัสสินค้าไม่ได้', 'error'); }
  };
  useEffect(() => {
    if (app.detailOpen) { setExiting(true); return undefined; }
    const timer = setTimeout(() => setExiting(false), 280);
    return () => clearTimeout(timer);
  }, [app.detailOpen]);
  if (!app.detailOpen && !exiting) return null;
  const close = () => app.closeProduct();
  return <>
    <div className={`detail-backdrop ${app.detailOpen ? 'is-entering' : 'is-leaving'}`} onClick={close} aria-hidden="true" />
    <aside className={`detail-panel ${app.detailOpen ? 'is-entering' : 'is-leaving'}`} inert={!app.detailOpen || undefined} role="dialog" aria-modal="true" aria-labelledby="detail-heading" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); setDragSlot(null); }} onKeyDown={(event) => { if (event.key === 'Escape') close(); if (event.key === 'Tab') app.handleDetailTab(event); }}>
      <header className="detail-header"><div><h2 id="detail-heading" tabIndex={-1} ref={(element) => { app.$refs.detailHeading = element; }}>รายละเอียดสินค้า</h2></div><div className="detail-header-actions">{app.editingDetail ? <><button type="button" className="button button-muted" onClick={() => app.cancelDetailEdit()} disabled={app.savingDetail}>ยกเลิก</button><button type="button" className="button button-primary" onClick={() => app.saveDetail()} disabled={app.savingDetail}>{app.savingDetail ? 'กำลังบันทึก…' : 'บันทึก'}</button></> : <button type="button" className="button button-primary" onClick={() => app.startDetailEdit()} disabled={app.imagesLoading || app.imagesError || app.noteLoading || !!app.noteError || app.shortNoteLoading || !!app.shortNoteError}>แก้ไข</button>}<button type="button" className="sidebar-icon-button" ref={(element) => { app.$refs.detailClose = element; }} onClick={close} disabled={app.savingDetail} aria-label="ปิดรายละเอียด"><X aria-hidden="true" /></button></div></header>
      <div className="detail-body"><h3 className="detail-name">{app.display(app.selectedProduct.name)}</h3>{app.detailSaveError && <p className="inline-error" role="alert">{app.detailSaveError}</p>}
        <section className="product-image-section" aria-label="รูปสินค้า">{app.imagesLoading && <p role="status">กำลังโหลดรูปสินค้า…</p>}{app.imagesError && <div className="inline-error" role="alert">โหลดรูปสินค้าไม่ได้ <button type="button" onClick={() => app.loadImages()}>ลองอีกครั้ง</button></div>}
          <div className="product-images">{app.imageSlots.map((image) => {
            const hasImage = !image.deletePending && Boolean(image.preview || (!image.missing && image.url));
            return <div className="product-image-card" key={image.slot}>
              <h4 className="image-title">รูปสินค้าที่ {image.slot}</h4>
              <div
                className={`product-image-frame${hasImage ? ' has-image' : ''}${app.editingDetail && !hasImage ? ' is-editable' : ''}${dragSlot === image.slot ? ' is-dragging' : ''}`}
                onClick={() => { if (app.editingDetail && !hasImage && !app.savingDetail && !app.imageBusy) document.getElementById(image.inputId)?.click(); }}
                onDragOver={(event) => { event.preventDefault(); if (app.editingDetail && !app.savingDetail && !app.imageBusy && event.dataTransfer.types.includes('Files')) { event.dataTransfer.dropEffect = 'copy'; setDragSlot(image.slot); } }}
                onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragSlot(null); }}
                onDrop={(event) => { event.preventDefault(); event.stopPropagation(); setDragSlot(null); if (!app.editingDetail || app.savingDetail || app.imageBusy) return; const files = event.dataTransfer.files; if (files.length === 1) app.selectImageFile(files[0], image); else if (files.length > 1) image.error = 'กรุณาวางรูปครั้งละ 1 รูปในแต่ละช่อง'; }}
              >
                {image.deletePending ? <div className="product-image-placeholder"><span className="image-placeholder-badge"><Trash2 aria-hidden="true" /></span><strong>รูปนี้จะถูกลบเมื่อบันทึก</strong></div> : image.preview ? <img src={image.preview} alt={`ตัวอย่างรูปสินค้าที่ ${image.slot} ที่เลือก`} /> : !image.missing && image.url ? <img src={image.url} onLoad={() => app.imageLoaded(image)} onError={() => app.imageFailed(image)} alt={`รูปสินค้าที่ ${image.slot}`} /> : <div className="product-image-placeholder"><span className="image-placeholder-badge">{app.editingDetail ? <Upload aria-hidden="true" /> : <ImageIcon aria-hidden="true" />}</span><strong>{app.editingDetail ? 'คลิกหรือลากรูปมาวาง' : 'ยังไม่มีรูปสินค้า'}</strong>{app.editingDetail && <span>JPEG, PNG, WebP · ไม่เกิน 5 MB</span>}</div>}
              </div>
              {app.editingDetail && <div className="image-actions"><label className={`image-select${app.imageBusy ? ' is-disabled' : ''}`} htmlFor={image.inputId}><Upload aria-hidden="true" /> {image.pending || image.path || !image.missing ? 'เปลี่ยนรูป' : 'เพิ่มรูป'}</label><input id={image.inputId} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" aria-label={`${image.pending || image.path || !image.missing ? 'เปลี่ยนรูป' : 'เลือกรูป'}สินค้าที่ ${image.slot}`} onChange={(event) => app.selectImage(event, image)} disabled={app.imageBusy || app.savingDetail} />{image.deletePending ? <button className="button button-muted" type="button" onClick={() => { image.deletePending = false; image.expectedDeletePath = undefined; image.error = ''; app.persistDetailEdit(); }} disabled={app.savingDetail}><RotateCcw aria-hidden="true" /> ยกเลิกการลบ</button> : (image.pending || image.path || !image.missing) && <button className="button button-danger" type="button" onClick={() => app.stageImageDelete(image)} disabled={app.imageBusy || app.savingDetail} aria-label={`ลบรูปที่ ${image.slot}`}><Trash2 aria-hidden="true" /> {image.pending && !image.path ? 'ยกเลิก' : 'ลบรูป'}</button>}</div>}
              {image.error && <p className="inline-error" role="alert">{image.error}</p>}{image.message && <p className="image-success" role="status">{image.message}</p>}
            </div>;
          })}</div>
          {app.imageSaveMessage && <p className="image-pending" role="status">{app.imageSaveMessage}</p>}
          {app.imageDraftError && <p className="inline-error" role="alert">{app.imageDraftError}</p>}
        </section>
        <section className="detail-general" aria-labelledby="general-heading"><h3 id="general-heading" className="detail-section-title">ข้อมูลทั่วไป</h3><dl className="detail-list"><div><dt>รหัสสินค้า</dt><dd className="product-code-value"><span>{app.display(app.selectedProduct.code)}</span>{app.selectedProduct.code && <button className="copy-code-button" type="button" onClick={copyCode} aria-label="คัดลอกรหัสสินค้า"><Copy aria-hidden="true" /></button>}</dd></div>{app.selectedProduct.barcode && <div><dt>บาร์โค้ด</dt><dd>{app.display(app.selectedProduct.barcode)}</dd></div>}<div><dt>ประเภท</dt><dd><span className="detail-category">{app.display(app.selectedProduct.category)}</span></dd></div><div><dt>หน่วย</dt><dd>{app.display(app.selectedProduct.unit)}</dd></div></dl></section>
        <section className="price-section" aria-labelledby="price-heading"><h3 id="price-heading" className="detail-section-title">ราคาขาย</h3>{app.editingDetail ? <div className="price-editor"><label className="sr-only" htmlFor="detail-price">ราคาขาย (บาท)</label><input id="detail-price" type="text" inputMode="decimal" autoComplete="off" maxLength={16} disabled={app.savingDetail} value={app.priceInput} onChange={(event) => { app.priceInput = event.target.value; app.persistDetailEdit(); }} aria-describedby="price-help price-error" /><p id="price-help" className="muted">กรอกราคาเป็นตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง</p><p id="price-error" className="inline-error" role="alert" hidden={!app.priceError}>{app.priceError}</p></div> : <div className="detail-price">{app.price(app.selectedProduct.price)}</div>}</section>
        <section className="note-section" aria-labelledby="note-heading"><h3 id="note-heading">คำอธิบายสินค้า</h3>{app.noteLoading ? <p role="status">กำลังโหลดคำอธิบาย…</p> : app.editingDetail ? <><label className="sr-only" htmlFor="product-note">คำอธิบายสินค้า</label><textarea id="product-note" maxLength={4000} rows={4} disabled={app.savingDetail} value={app.noteInput} onChange={(event) => { app.noteInput = event.target.value; app.persistDetailEdit(); }} /><p className="muted">ไม่เกิน 4,000 ตัวอักษร</p></> : <p className="note-text">{app.note || 'ยังไม่มีคำอธิบายสินค้า'}</p>}{app.noteError && <p className="inline-error" role="alert">{app.noteError} {!app.editingDetail && <button type="button" onClick={() => app.loadNote()}>ลองอีกครั้ง</button>}</p>}</section>
        <section className="note-section" aria-labelledby="short-note-heading"><h3 id="short-note-heading">คำอธิบายโดยย่อ</h3>{app.shortNoteLoading ? <p role="status">กำลังโหลดคำอธิบายโดยย่อ…</p> : app.editingDetail ? <><label className="sr-only" htmlFor="product-short-note">คำอธิบายโดยย่อ</label><textarea id="product-short-note" maxLength={255} rows={3} disabled={app.savingDetail} value={app.shortNoteInput} onChange={(event) => { app.shortNoteInput = event.target.value; app.persistDetailEdit(); }} /><p className="muted">ไม่เกิน 255 ตัวอักษร</p></> : <p className="note-text">{app.shortNote || 'ยังไม่มีคำอธิบายโดยย่อ'}</p>}{app.shortNoteError && <p className="inline-error" role="alert">{app.shortNoteError} {!app.editingDetail && <button type="button" onClick={() => app.loadShortNote()}>ลองอีกครั้ง</button>}</p>}</section>
      </div>
    </aside>
  </>;
}
