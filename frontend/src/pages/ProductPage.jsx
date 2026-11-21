import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, CircleAlert, Grid2X2, List, PackageSearch, Search, X } from 'lucide-react';
import { FilterSelect } from '../components/FilterSelect.jsx';
import { ProductThumbnail } from '../components/product/ProductThumbnail.jsx';

function ProductTableCols() {
  return <colgroup>
    <col className="col-code" />
    <col className="col-name" />
    <col className="col-category" />
    <col className="col-unit" />
    <col className="col-price" />
    <col className="col-detail" />
  </colgroup>;
}

export function ProductPage({ app }) {
  const [showImages, setShowImages] = useState(() => {
    try { return sessionStorage.getItem('sptc.show-product-images') === 'true'; } catch { return false; }
  });
  const [view, setView] = useState(() => {
    try { return sessionStorage.getItem('sptc.product-view') === 'grid' ? 'grid' : 'table'; } catch { return 'table'; }
  });
  const [customSize, setCustomSize] = useState(() => (
    [10, 20, 50, 100].includes(app.pageSize) ? '' : String(app.pageSize ?? '')
  ));

  const selectPageSize = (size) => {
    setCustomSize('');
    app.changePageSize(size);
  };
  const submitCustomPageSize = (event) => {
    event.preventDefault();
    if (!customSize.trim()) return;
    if (app.changePageSize(customSize) && [10, 20, 50, 100].includes(app.pageSize)) setCustomSize('');
  };

  const changeView = (value) => {
    setView(value);
    try { sessionStorage.setItem('sptc.product-view', value); } catch { /* Continue without saving the preference. */ }
  };
  const toggleImages = (checked) => {
    setShowImages(checked);
    try { sessionStorage.setItem('sptc.show-product-images', String(checked)); } catch { /* Continue without saving the preference. */ }
  };
  return <main className="container-xl catalog-main" aria-labelledby="catalog-heading" inert={app.backgroundInert || undefined}>
    <h1 id="catalog-heading" className="sr-only" tabIndex={-1}>รายการสินค้า</h1>
    <section className="catalog-panel" aria-label="ค้นหาและดูรายการสินค้า">
      {app.demo && <div className="dataset"><span /> ข้อมูลตัวอย่าง</div>}
      <div className="catalog-toolbar"><form className="search-form" role="search" onSubmit={(event) => { event.preventDefault(); app.submitSearch(); }}>
        <FilterSelect id="product-type" label="ประเภทสินค้า" value={app.selectedType} options={app.types} placeholder="ทุกประเภท" disabled={app.typesBusy} describedBy="type-status" onChange={(nextValue) => { app.selectedType = nextValue; app.typeChanged(); }} />
        <FilterSelect id="product-unit" label="หน่วยสินค้า" value={app.selectedUnit} options={app.units} placeholder="ทุกหน่วย" disabled={app.unitsBusy} describedBy="unit-status" onChange={(nextValue) => { app.selectedUnit = nextValue; app.unitChanged(); }} />
        <label className="sr-only" htmlFor="catalog-search">ค้นหาสินค้า</label><div className="field-control search-field"><Search aria-hidden="true" /><input id="catalog-search" name="q" ref={(element) => { app.$refs.search = element; }} placeholder="ค้นหาชื่อหรือรหัสสินค้า" maxLength={100} value={app.searchInput} onChange={(event) => { app.searchInput = event.target.value; }} type="search" />{app.searchInput && <button className="search-clear" type="button" onClick={() => app.clearSearch()} aria-label="ล้างคำค้นหา"><X aria-hidden="true" /></button>}</div><button className="button button-primary search-button" type="submit">ค้นหา</button>
      </form><p className="product-count" aria-live="polite">{app.resultCount}</p></div>
      <div id="type-status" className="type-status" aria-live="polite">{app.typesError && <span>โหลดประเภทสินค้าไม่ได้ <button type="button" onClick={() => app.loadTypes()}>ลองอีกครั้ง</button></span>}</div>
      <div id="unit-status" className="type-status" aria-live="polite">{app.unitsError && <span>โหลดหน่วยสินค้าไม่ได้ <button type="button" onClick={() => app.loadUnits()}>ลองอีกครั้ง</button></span>}</div>
      <div className="catalog-view-options">{view === 'table' && <label className="catalog-image-toggle"><input type="checkbox" checked={showImages} onChange={(event) => toggleImages(event.target.checked)} /> แสดงรูปสินค้า</label>}<div className="catalog-view-switch" data-view={view} role="group" aria-label="มุมมองรายการสินค้า"><button type="button" aria-pressed={view === 'table'} onClick={() => changeView('table')}><List aria-hidden="true" /> Table</button><button type="button" aria-pressed={view === 'grid'} onClick={() => changeView('grid')}><Grid2X2 aria-hidden="true" /> Grid</button></div></div>
      {view === 'table' && <div className="catalog-table-header" aria-hidden="true"><table className="product-table"><ProductTableCols /><thead><tr><th scope="col">รหัสสินค้า</th><th scope="col">ชื่อสินค้า</th><th scope="col">ประเภท</th><th scope="col">หน่วย</th><th scope="col" className="price-cell">ราคาขาย</th><th scope="col"><span className="sr-only">รายละเอียด</span></th></tr></thead></table></div>}
      <div className="catalog-list-scroll">
        {view === 'table' ? <div className="table-scroll" aria-busy={app.productsBusy}><table className="product-table"><ProductTableCols /><thead className="desktop-sr-only"><tr><th scope="col">รหัสสินค้า</th><th scope="col">ชื่อสินค้า</th><th scope="col">ประเภท</th><th scope="col">หน่วย</th><th scope="col" className="price-cell">ราคาขาย</th><th scope="col"><span className="sr-only">รายละเอียด</span></th></tr></thead><tbody>
          {app.items.map((item) => <tr key={item.id}><td className="code-cell">{app.display(item.code)}</td><td><div className="catalog-product">{showImages && <ProductThumbnail key={`${item.id}-${app.catalogImageVersion}`} id={item.id} version={app.catalogImageVersion} />}<div className="catalog-product-text"><span className="product-name">{app.display(item.name)}</span><span className="mobile-code">{app.display(item.code)}</span></div></div></td><td className="category-cell">{app.display(item.category)}</td><td className="unit-cell">{app.display(item.unit)}</td><td className="price-cell">{app.price(item.price)}</td><td className="detail-cell"><button className="detail-button" type="button" data-product-id={item.id} onClick={() => app.openProduct(item)} aria-label={app.detailLabel(item)}>ดู<span>รายละเอียด</span><span aria-hidden="true"> ↗</span></button></td></tr>)}
        </tbody></table></div> : <ul className="product-grid" aria-label="รายการสินค้า" aria-busy={app.productsBusy}>{app.items.map((item) => <li className="product-card" key={item.id}><ProductThumbnail key={`${item.id}-${app.catalogImageVersion}`} id={item.id} version={app.catalogImageVersion} large /><div className="product-card-body"><span className="product-card-code">{app.display(item.code)}</span><h3 className="product-card-name">{app.display(item.name)}</h3><div className="product-card-footer"><span className="product-card-price">{app.price(item.price)}</span><button className="detail-button" type="button" data-product-id={item.id} onClick={() => app.openProduct(item)} aria-label={app.detailLabel(item)}>ดูรายละเอียด <span aria-hidden="true">↗</span></button></div></div></li>)}</ul>}
        {app.productsBusy && <div className="catalog-state" role="status">กำลังโหลดสินค้า…</div>}
        {app.showEmpty && <div className="catalog-state" role="status"><PackageSearch aria-hidden="true" /><strong>ไม่พบสินค้า</strong><span>ลองเปลี่ยนคำค้นหา ประเภท หรือหน่วยสินค้า</span></div>}
        {app.catalogError && <div className="catalog-state error-state" role="alert"><CircleAlert aria-hidden="true" /><strong>{app.catalogError}</strong><button className="button button-muted retry-button" type="button" onClick={() => app.refresh()}>ลองอีกครั้ง</button></div>}
      </div>
      {app.showPagination && <div className="table-footer"><span aria-live="polite">{app.resultRange}</span><div className="page-size-control" role="group" aria-label="จำนวนรายการต่อหน้า"><span className="page-size-label">แสดง</span>{[10, 20, 50, 100].map((size) => <button key={size} type="button" className="page-size-chip" aria-pressed={app.pageSize === size} onClick={() => selectPageSize(size)}>{size}</button>)}<form className="page-size-custom" onSubmit={submitCustomPageSize}><label className="sr-only" htmlFor="custom-page-size">กำหนดจำนวนต่อหน้าเอง (กด Enter)</label><input id="custom-page-size" type="number" min={1} max={500} inputMode="numeric" placeholder="กรอกเอง" value={customSize} onChange={(event) => setCustomSize(event.target.value)} /></form></div><nav className="pagination" aria-label="หน้ารายการสินค้า"><button type="button" onClick={() => app.previousPage()} disabled={app.atFirstPage} aria-label="หน้าก่อนหน้า"><ChevronLeft aria-hidden="true" /></button><span aria-live="polite">{app.pageLabel}</span><button type="button" onClick={() => app.nextPage()} disabled={app.atLastPage} aria-label="หน้าถัดไป"><ChevronRight aria-hidden="true" /></button></nav></div>}
    </section>
  </main>;
}
