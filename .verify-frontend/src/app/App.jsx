import React, { useEffect, useMemo, useSyncExternalStore } from 'react';
import { Login } from '../auth/Login.jsx';
import { Shell } from './Shell.jsx';
import { ProductPage } from './product/ProductPage.jsx';
import { ProductDetail } from './product/ProductDetail.jsx';
import { createAppStore } from './store.js';

export function App() {
  const store = useMemo(() => createAppStore(), []);
  useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
  const { app } = store;
  useEffect(() => { app.init(); return () => app.destroy(); }, [app]);
  if (app.booting) return <div className="loading-screen" role="status">กำลังโหลดระบบ</div>;
  if (!app.user) return <Login app={app} />;
  return <Shell app={app}><ProductPage app={app} /><ProductDetail app={app} /></Shell>;
}
