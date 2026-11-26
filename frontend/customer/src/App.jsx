import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ImageOff, Info, LayoutGrid, Search, X, Zap } from 'lucide-react';
import logoUrl from '../../shared/assets/sidebar-logo.jpg';
import { display, number, price, rowRange } from '../../shared/utils/format.js';
import { resolveApiUrl } from '../../shared/utils/api-base.js';
import { fetchPublic } from './services/api.js';
import { CarouselSection } from './components/CarouselSection.jsx';
import { ProductDetailModal } from './components/ProductDetailModal.jsx';

function CampaignSection({ id, title, items }) {
  if (items.length === 0) return null;

  return <section id={id} className="store-section campaign-section" aria-labelledby={`${id}-heading`}>
    <h2 id={`${id}-heading`} className="section-heading">{title}</h2>
    <ul className="promo-grid">
      {items.map((item) => (
        <li key={item.id} className="promo-card">
          <figure>
            <img src={item.imageUrl} alt={item.title ? '' : title} loading="lazy" referrerPolicy="no-referrer" />
            {item.title && <figcaption>{item.title}</figcaption>}
          </figure>
        </li>
      ))}
    </ul>
  </section>;
}

function CategoryNav({ hasPromotions, types, selectedType, onSelect }) {
  const viewportRef = useRef(null);
  const listRef = useRef(null);
  const [edges, setEdges] = useState({ previous: false, next: false });

  useEffect(() => {
    const viewport = viewportRef.current;
    const list = listRef.current;
    const update = () => {
      const previous = viewport.scrollLeft > 1;
      const next = viewport.scrollWidth - viewport.clientWidth - viewport.scrollLeft > 1;
      setEdges((current) => current.previous === previous && current.next === next ? current : { previous, next });
    };
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    observer.observe(list);
    viewport.addEventListener('scroll', update, { passive: true });
    update();
    return () => {
      observer.disconnect();
      viewport.removeEventListener('scroll', update);
    };
  }, []);

  const scroll = (direction) => {
    const viewport = viewportRef.current;
    viewport.scrollBy({ left: direction * viewport.clientWidth * .75 });
  };

  return <nav className="store-category-bar" aria-label="โปรโมชันและประเภทสินค้า">
    <div className="store-container store-category-inner">
      <button type="button" className="category-scroll category-scroll-prev" aria-controls="store-category-list"
        aria-label="เลื่อนประเภทสินค้าย้อนกลับ" disabled={!edges.previous} onClick={() => scroll(-1)}>
        <ChevronLeft aria-hidden="true" />
      </button>
      <div id="store-category-list" className="category-viewport" ref={viewportRef}>
        <ul className="category-list" ref={listRef}>
          {hasPromotions && <li><a className="store-promo-link" href="#promotions"><Zap aria-hidden="true" />โปรโมชัน</a></li>}
          {types.length > 0 && ['', ...types].map((name) => <li key={name}>
            <button type="button" aria-pressed={selectedType === name} onClick={() => onSelect(name)}>
              {name || 'ทุกประเภท'}
            </button>
          </li>)}
        </ul>
      </div>
      <button type="button" className="category-scroll category-scroll-next" aria-controls="store-category-list"
        aria-label="เลื่อนดูประเภทสินค้าถัดไป" disabled={!edges.next} onClick={() => scroll(1)}>
        <ChevronRight aria-hidden="true" />
      </button>
    </div>
  </nav>;
}

export function App() {
  const [storefront, setStorefront] = useState({ carousel: [], promoBanner: [], promoSale: [], demo: false });
  const [filters, setFilters] = useState({ types: [], units: [] });
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState({ q: '', type: '', unit: '', page: 1 });
  const [catalog, setCatalog] = useState({ items: [], page: 1, pageSize: 24, total: 0, totalPages: 1 });
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [detailState, setDetailState] = useState({ item: null, loading: false, error: false });
  const [detailReload, setDetailReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchPublic('storefront', { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        const mapImg = (rows = []) => rows.map((row) => ({ ...row, imageUrl: resolveApiUrl(row.imageUrl) }));
        setStorefront({
          carousel: mapImg(data.carousel),
          promoBanner: mapImg(data.promoBanner),
          promoSale: mapImg(data.promoSale),
          demo: Boolean(data.demo),
        });
      })
      .catch(() => { /* Storefront banners are optional. */ });
    fetchPublic('catalog-filters', { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setFilters(data); })
      .catch(() => { /* Filter options are optional. */ });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoadingCatalog(true);
    setCatalogError('');
    fetchPublic('catalog', {
      query: { q: query.q, type: query.type, unit: query.unit, page: String(query.page), pageSize: '24' },
      signal: controller.signal,
    })
      .then((data) => {
        if (controller.signal.aborted) return;
        setCatalog({
          ...data,
          items: (data.items ?? []).map((item) => ({ ...item, images: (item.images ?? []).map(resolveApiUrl) })),
        });
      })
      .catch(() => { if (!controller.signal.aborted) setCatalogError('โหลดรายการสินค้าไม่สำเร็จ กรุณาลองอีกครั้ง'); })
      .finally(() => { if (!controller.signal.aborted) setLoadingCatalog(false); });
    return () => controller.abort();
  }, [query]);

  useEffect(() => {
    if (!selectedId) {
      setDetailState({ item: null, loading: false, error: false });
      return undefined;
    }
    const controller = new AbortController();
    setDetailState({ item: null, loading: true, error: false });
    fetchPublic('catalog-item', { query: { id: selectedId }, signal: controller.signal })
      .then((item) => {
        if (controller.signal.aborted) return;
        setDetailState({ item: { ...item, images: (item.images ?? []).map(resolveApiUrl) }, loading: false, error: false });
      })
      .catch(() => { if (!controller.signal.aborted) setDetailState({ item: null, loading: false, error: true }); });
    return () => controller.abort();
  }, [selectedId, detailReload]);

  const showCatalog = () => {
    const heading = document.getElementById('catalog-heading');
    heading?.focus({ preventScroll: true });
    document.getElementById('catalog')?.scrollIntoView();
  };

  const submitSearch = (event) => {
    event.preventDefault();
    setQuery((prev) => ({ ...prev, q: searchInput.trim(), page: 1 }));
    showCatalog();
  };

  const clearSearch = () => {
    setSearchInput('');
    setQuery((prev) => ({ ...prev, q: '', page: 1 }));
  };

  const hasPromotions = storefront.carousel.length > 0 || storefront.promoBanner.length > 0 || storefront.promoSale.length > 0;

  return <div id="top" className="store-layout">
    <header className="store-topbar">
      <div className="store-utility">
        <div className="store-container store-utility-inner">
          {storefront.demo && <span className="store-demo-badge">โหมดข้อมูลตัวอย่าง</span>}
          <a href="#top">หน้าแรก</a>
        </div>
      </div>
      <div className="store-container store-topbar-inner">
        <a href="#top" className="store-brand">
          <img className="store-logo" src={logoUrl} alt="" />
          <span>SPTC<span className="brand-dot">.</span></span>
        </a>
        <form className="store-search" role="search" onSubmit={submitSearch}>
          <div className="search-box">
            <input type="search" value={searchInput} onChange={(e) => setSearchInput(e.currentTarget.value)}
              placeholder="ค้นหาชื่อหรือรหัสสินค้า" aria-label="ค้นหาชื่อหรือรหัสสินค้า" maxLength={100} />
            {searchInput && <button type="button" className="search-clear" onClick={clearSearch} aria-label="ล้างคำค้นหา">
              <X aria-hidden="true" />
            </button>}
          </div>
          <button type="submit" className="store-search-submit" aria-label="ค้นหา"><Search aria-hidden="true" /></button>
        </form>
        <nav className="store-nav" aria-label="เมนูหลัก">
          <a href="#catalog"><LayoutGrid aria-hidden="true" />สินค้าทั้งหมด</a>
        </nav>
      </div>
      {(hasPromotions || filters.types.length > 0) && <CategoryNav hasPromotions={hasPromotions}
        types={filters.types} selectedType={query.type} onSelect={(name) => {
          setQuery((prev) => ({ ...prev, type: name, page: 1 }));
          showCatalog();
        }} />}
    </header>

    <main className="store-main store-container">
      <section id={hasPromotions ? 'promotions' : undefined} className="store-hero" aria-labelledby="store-heading">
        <CarouselSection slides={storefront.carousel} />
        <div className="store-hero-copy">
          <h1 id="store-heading">{hasPromotions ? 'โปรโมชันและสินค้า' : 'แคตตาล็อกสินค้า'}</h1>
          <nav className="store-hero-links" aria-label={hasPromotions ? 'ข้ามไปยังโปรโมชันและสินค้า' : 'ข้ามไปยังสินค้า'}>
            {storefront.promoBanner.length > 0 && <a className="store-hero-link" href="#recommended">โปรโมชันแนะนำ</a>}
            {storefront.promoSale.length > 0 && <a className="store-hero-link" href="#sale">โปรโมชันลดราคา</a>}
            <a className="store-hero-link" href="#catalog">ดูสินค้าทั้งหมด</a>
          </nav>
        </div>
      </section>

      <CampaignSection id="recommended" title="โปรโมชันแนะนำ" items={storefront.promoBanner} />
      <CampaignSection id="sale" title="โปรโมชันลดราคา" items={storefront.promoSale} />

      <section id="catalog" className="store-section store-catalog" aria-labelledby="catalog-heading">
        <div className="catalog-head">
          <h2 id="catalog-heading" className="section-heading" tabIndex={-1}>รายการสินค้า</h2>
          {!loadingCatalog && !catalogError && <p className="catalog-total" role="status">{number.format(catalog.total)} รายการ</p>}
        </div>

        <div className="store-toolbar" role="group" aria-label="ตัวกรองสินค้า">
          <select value={query.type} aria-label="กรองตามประเภทสินค้า"
            onChange={(e) => setQuery((prev) => ({ ...prev, type: e.currentTarget.value, page: 1 }))}>
            <option value="">ทุกประเภท</option>
            {filters.types.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          <select value={query.unit} aria-label="กรองตามหน่วยสินค้า"
            onChange={(e) => setQuery((prev) => ({ ...prev, unit: e.currentTarget.value, page: 1 }))}>
            <option value="">ทุกหน่วย</option>
            {filters.units.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>

        {loadingCatalog && <div className="store-loading" aria-busy="true"><span className="loading-spinner" aria-hidden="true" /></div>}
        {catalogError && <div className="store-alert" role="alert">
          {catalogError} <button type="button" onClick={() => setQuery((prev) => ({ ...prev }))}>ลองอีกครั้ง</button>
        </div>}
        {!loadingCatalog && !catalogError && catalog.items.length === 0 && <div className="store-empty">ไม่พบสินค้าที่ตรงกับเงื่อนไข</div>}

        {!loadingCatalog && !catalogError && catalog.items.length > 0 && <>
          <ul className="catalog-grid">
            {catalog.items.map((item) => (
              <li key={item.id} className="catalog-card">
                <button type="button" className="catalog-card-button" onClick={() => setSelectedId(item.id)}>
                  <span className="catalog-card-image">
                    {item.images?.[0]
                      ? <img src={item.images[0]} alt="" loading="lazy" referrerPolicy="no-referrer" />
                      : <span className="image-empty"><ImageOff aria-hidden="true" /></span>}
                  </span>
                  <span className="catalog-card-body">
                    <strong className="card-name">{display(item.name)}</strong>
                    <span className="card-meta">{display(item.code)} · {display(item.category)}</span>
                    <span className="card-footer">
                      <span className="card-price-group">
                        <span className="card-price">{price(item.price)}</span>
                        {item.unit && <span className="card-unit">/ {item.unit}</span>}
                      </span>
                      <span className="card-detail-icon"><Info aria-hidden="true" /><span className="sr-only">ดูรายละเอียดสินค้า</span></span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <footer className="store-pagination">
            <span>{rowRange(catalog.page, catalog.pageSize, catalog.total)}</span>
            <div className="pagination-controls">
              <button type="button" disabled={catalog.page <= 1}
                onClick={() => setQuery((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                aria-label="หน้าก่อนหน้า">
                <ChevronLeft aria-hidden="true" />
              </button>
              <span>หน้า {number.format(catalog.page)} / {number.format(catalog.totalPages)}</span>
              <button type="button" disabled={catalog.page >= catalog.totalPages}
                onClick={() => setQuery((prev) => ({ ...prev, page: Math.min(catalog.totalPages, prev.page + 1) }))}
                aria-label="หน้าถัดไป">
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
          </footer>
        </>}
      </section>
    </main>

    <ProductDetailModal
      item={detailState.item}
      loading={detailState.loading}
      error={detailState.error}
      onClose={() => setSelectedId(null)}
      onRetry={() => setDetailReload((n) => n + 1)}
    />
  </div>;
}
