import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, LogOut, PanelLeft, UserRound } from 'lucide-react';
import sidebarLogo from '../../../shared/assets/favicon-transparent.png';
import { ThemeMenu } from '../components/ThemeMenu.jsx';
import { websiteImageMenus } from '../routes/website-image-menus.js';

const menuGroups = [
  { id: 'catalog', title: 'สินค้า', menus: [{ id: 'products', title: 'รายการสินค้า' }] },
  { id: 'website', title: 'ภาพเว็บไซต์', menus: websiteImageMenus },
];

export function Shell({ app, children, activePage, onNavigate, imageEditorOpen }) {
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
    <aside id="catalog-sidebar" className={`catalog-sidebar ${app.sidebarClass}`} inert={(!app.sidebarOpen || app.detailOpen || imageEditorOpen) || undefined} role={app.sidebarRole || undefined} aria-modal={app.sidebarModal || undefined} aria-label="เมนูหลัก" onKeyDown={sidebarKey}>
      <div className="sidebar-header"><p className="sidebar-title">เมนู</p><button className="sidebar-icon-button sidebar-close" type="button" ref={(element) => { app.$refs.sidebarClose = element; }} onClick={() => app.closeSidebar()} aria-label="ปิดเมนู" aria-controls="catalog-sidebar"><ChevronLeft aria-hidden="true" /></button></div>
      <nav className="sidebar-nav" aria-label="เมนูหลัก">
        {menuGroups.map((group) => <div className="sidebar-group" role="group" aria-labelledby={`sidebar-group-${group.id}`} key={group.id}>
          <p className="sidebar-group-title" id={`sidebar-group-${group.id}`}>{group.title}</p>
          {group.menus.map(({ id, title }) =>
            <a key={id} href={id === 'products' ? '#catalog-heading' : '#website-images-heading'} className="sidebar-link"
              aria-current={activePage === id ? 'page' : undefined}
              ref={id === websiteImageMenus.at(-1).id ? (element) => { app.$refs.lastSidebarLink = element; } : undefined}
              onClick={(event) => { event.preventDefault(); onNavigate(id); }}>{title}</a>
          )}
        </div>)}
      </nav>
    </aside>
    <div className={`sidebar-backdrop ${app.sidebarClass}`} onClick={() => app.closeSidebar()} aria-hidden="true" />
    <header className="catalog-topbar" inert={(app.backgroundInert || imageEditorOpen) || undefined}>
      <div className="topbar-start"><img className="topbar-logo" src={sidebarLogo} alt="" /><div className="topbar-brand"><span>SPTC<span className="topbar-dot">.</span></span><span className="topbar-module">Admin Console</span></div></div>
      <div className="topbar-end">
      <ThemeMenu />
      <div className="topbar-account" ref={accountRef} onKeyDown={(event) => { if (event.key === 'Escape' && accountOpen) { setAccountOpen(false); accountButtonRef.current?.focus(); } }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setAccountOpen(false); }}><button className="topbar-account-toggle" ref={accountButtonRef} type="button" aria-label={`บัญชีผู้ใช้ ${app.accountName}`} aria-expanded={accountOpen} aria-controls="account-menu" onClick={() => setAccountOpen((open) => !open)}><span className="topbar-avatar"><UserRound aria-hidden="true" /></span><span className="topbar-username">{app.accountName}</span><ChevronDown className="topbar-chevron" aria-hidden="true" /></button><div id="account-menu" className={`topbar-account-menu${accountOpen ? ' is-open' : ''}`} inert={!accountOpen || undefined}><button type="button" onClick={() => app.signOut()} disabled={app.logoutBusy}><LogOut aria-hidden="true" /> ออกจากระบบ</button></div></div>
      </div>
    </header>
    <div className="catalog-subbar" inert={(app.backgroundInert || imageEditorOpen) || undefined}>
      <button className="panel-toggle" type="button" ref={(element) => { app.$refs.sidebarToggle = element; }} onClick={() => app.toggleSidebar()} aria-label={app.sidebarOpen ? 'ปิดเมนู' : 'เปิดเมนู'} aria-controls="catalog-sidebar" aria-expanded={app.sidebarExpanded}><PanelLeft aria-hidden="true" /></button>
    </div>
    {children}
  </div>;
}
