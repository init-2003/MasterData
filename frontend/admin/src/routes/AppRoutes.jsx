import React, { useState } from 'react';
import { Login } from '../pages/Login.jsx';
import { ProductPage } from '../pages/ProductPage.jsx';
import { ProductDetail } from '../components/product/ProductDetail.jsx';
import { Shell } from '../layouts/Shell.jsx';
import { PromoBannerPage } from '../pages/PromoBannerPage.jsx';
import { PromoSalePage } from '../pages/PromoSalePage.jsx';
import { CarouselPage } from '../pages/CarouselPage.jsx';
import { PromotionLevelPage } from '../pages/PromotionLevelPage.jsx';
import { readWebsiteImageDraft } from '../services/website-image-drafts.js';
import { carouselMenu, promoBannerMenu, promoSaleMenu, promotionLevelMenu, readActivePage, saveActivePage } from './website-image-menus.js';

const imagePages = new Map([
  [promoBannerMenu.id, PromoBannerPage],
  [promoSaleMenu.id, PromoSalePage],
  [carouselMenu.id, CarouselPage],
  [promotionLevelMenu.id, PromotionLevelPage],
]);

function AuthenticatedRoutes({ app }) {
  const [activePage, setActivePage] = useState(() => readActivePage(app.user.username));
  const [imageEditorOpen, setImageEditorOpen] = useState(() => imagePages.has(activePage)
    && Boolean(readWebsiteImageDraft(app.user.username, activePage)));
  const ImagePage = imagePages.get(activePage);

  function navigate(page) {
    setActivePage(page);
    saveActivePage(app.user.username, page);
    if (page !== activePage) setImageEditorOpen(imagePages.has(page) && Boolean(readWebsiteImageDraft(app.user.username, page)));
    if (page === 'products') {
      app.showProducts();
      return;
    }
    if (app.isCompact && app.sidebarOpen) app.closeSidebar();
    app.$nextTick(() => document.getElementById('website-images-heading')?.focus());
  }

  return <Shell app={app} activePage={activePage} onNavigate={navigate} imageEditorOpen={imageEditorOpen}>
    {ImagePage ? <ImagePage app={app} editorOpen={imageEditorOpen} setEditorOpen={setImageEditorOpen} />
      : <><ProductPage app={app} /><ProductDetail app={app} /></>}
  </Shell>;
}

export function AppRoutes({ app }) {
  if (app.booting) return <div className="loading-screen" aria-busy="true">
    <span className="loading-spinner" aria-hidden="true" />
  </div>;
  if (!app.user) return <Login app={app} />;
  return <AuthenticatedRoutes app={app} />;
}
