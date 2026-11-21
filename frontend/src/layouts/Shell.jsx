import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, Menu, UserRound, X } from 'lucide-react';
import sidebarLogo from '../assets/favicon-transparent.png';

export function Shell({ app, children }) {
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef(null);
  const accountButtonRef = useRef(null);
  useEffect(() => {
    if (!accountOpen) return undefined;
    const closeOutside = (event) => { if (!accountRef.current?.contains(event.target)) setAccountOpen(false); };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [accountOpen]);
  const sidebarKey = (event) => {
    if (event.key === 'Escape') app.closeSidebar();
    if (event.key === 'Tab') app.handleSidebarTab(event);
  };
  return <div className={`catalog-layout${app.sidebarOpen ? ' has-sidebar' : ''}`}>
    <aside id="catalog-sidebar" className={`catalog-sidebar ${app.sidebarClass}`} inert={(!app.sidebarOpen || app.detailOpen) || undefined} role={app.sidebarRole || undefined} aria-modal={app.sidebarModal || undefined} aria-label="เมนูหลัก" onKeyDown={sidebarKey}>
      <div className="sidebar-header"><button className="sidebar-icon-button sidebar-close" type="button" ref={(element) => { app.$refs.sidebarClose = element; }} onClick={() => app.closeSidebar()} aria-label="ปิดเมนู"><X aria-hidden="true" /></button></div>
      <nav className="sidebar-nav" aria-label="เมนูหลัก"><a className="sidebar-link" href="#catalog-heading" aria-current="page" ref={(element) => { app.$refs.catalogLink = element; }} onClick={(event) => { event.preventDefault(); app.showProducts(); }}><span>รายการสินค้า</span></a></nav>
    </aside>
    <div className={`sidebar-backdrop ${app.sidebarClass}`} onClick={() => app.closeSidebar()} aria-hidden="true" />
    <header className="catalog-topbar" inert={app.backgroundInert || undefined}>
      <div className="topbar-start"><button className="topbar-menu" type="button" ref={(element) => { app.$refs.sidebarToggle = element; }} onClick={() => app.toggleSidebar()} aria-label={app.sidebarOpen ? 'ปิดเมนู' : 'เปิดเมนู'} aria-controls="catalog-sidebar" aria-expanded={app.sidebarExpanded}><Menu aria-hidden="true" /></button><img className="topbar-logo" src={sidebarLogo} alt="" /><div className="topbar-brand"><span>SPTC<span className="topbar-dot">.</span></span><span className="topbar-module">Master Data</span></div></div>
      <div className="topbar-account" ref={accountRef} onKeyDown={(event) => { if (event.key === 'Escape' && accountOpen) { setAccountOpen(false); accountButtonRef.current?.focus(); } }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setAccountOpen(false); }}><button className="topbar-account-toggle" ref={accountButtonRef} type="button" aria-label={`บัญชีผู้ใช้ ${app.accountName}`} aria-expanded={accountOpen} aria-controls="account-menu" onClick={() => setAccountOpen((open) => !open)}><span className="topbar-avatar"><UserRound aria-hidden="true" /></span><span className="topbar-username">{app.accountName}</span><ChevronDown className="topbar-chevron" aria-hidden="true" /></button><div id="account-menu" className={`topbar-account-menu${accountOpen ? ' is-open' : ''}`} inert={!accountOpen || undefined}><button type="button" onClick={() => app.signOut()} disabled={app.logoutBusy}><LogOut aria-hidden="true" /> ออกจากระบบ</button></div></div>
    </header>
    {children}
  </div>;
}
