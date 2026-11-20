import React from 'react';
import { LogOut, Menu, PackageOpen, UserRound, X } from 'lucide-react';
import { Brand } from '../auth/Login.jsx';
import sidebarLogo from '../assets/sidebar-logo.jpg';

export function Shell({ app, children }) {
  const sidebarKey = (event) => {
    if (event.key === 'Escape') app.closeSidebar();
    if (event.key === 'Tab') app.handleSidebarTab(event);
  };
  return <div className="catalog-layout">
    <aside id="catalog-sidebar" className={`catalog-sidebar ${app.sidebarClass}`} inert={app.detailOpen || undefined} role={app.sidebarRole || undefined} aria-modal={app.sidebarModal || undefined} aria-labelledby="sidebar-title" onKeyDown={sidebarKey}>
      <div className="sidebar-header"><div className="brand" id="sidebar-title"><img className="sidebar-logo" src={sidebarLogo} alt="" /><span className="sidebar-brand-text"><span>SPTC<span className="brand-dot">.</span></span><span className="sidebar-module">Master Data</span></span></div>
        <button className="sidebar-icon-button sidebar-close" type="button" ref={(element) => { app.$refs.sidebarClose = element; }} onClick={() => app.closeSidebar()} aria-label="ปิดเมนู"><X aria-hidden="true" /></button></div>
      <nav className="sidebar-nav" aria-label="เมนูหลัก"><a className="sidebar-link" href="#catalog-heading" aria-current="page" ref={(element) => { app.$refs.catalogLink = element; }} onClick={(event) => { event.preventDefault(); app.showProducts(); }}><span className="sidebar-link-icon" aria-hidden="true"><PackageOpen /></span><span>รายการสินค้า</span></a></nav>
      <div className="sidebar-footer"><div className="sidebar-account"><span className="sidebar-avatar" aria-hidden="true"><UserRound /></span><span className="account-name" title={app.accountName}>{app.accountName}</span></div><button className="button button-muted logout-button" type="button" ref={(element) => { app.$refs.sidebarLogout = element; }} onClick={() => app.signOut()} disabled={app.logoutBusy}><LogOut aria-hidden="true" /><span>ออกจากระบบ</span></button></div>
    </aside>
    <div className={`sidebar-backdrop ${app.sidebarClass}`} onClick={() => app.closeSidebar()} aria-hidden="true" />
    <header className="catalog-mobile-bar" inert={app.backgroundInert || undefined}><button className="sidebar-icon-button" type="button" ref={(element) => { app.$refs.sidebarToggle = element; }} onClick={() => app.openSidebar()} aria-label="เปิดเมนู" aria-controls="catalog-sidebar" aria-expanded={app.sidebarExpanded}><Menu aria-hidden="true" /></button><Brand /></header>
    {children}
  </div>;
}
