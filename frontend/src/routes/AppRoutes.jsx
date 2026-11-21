import React from 'react';
import { Login } from '../pages/Login.jsx';
import { ProductPage } from '../pages/ProductPage.jsx';
import { ProductDetail } from '../components/product/ProductDetail.jsx';
import { Shell } from '../layouts/Shell.jsx';

export function AppRoutes({ app }) {
  if (app.booting) return <div className="loading-screen" role="status">กำลังโหลดระบบ</div>;
  if (!app.user) return <Login app={app} />;
  return <Shell app={app}><ProductPage app={app} /><ProductDetail app={app} /></Shell>;
}
