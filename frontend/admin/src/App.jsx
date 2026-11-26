import React, { useEffect, useMemo, useSyncExternalStore } from 'react';
import { AppRoutes } from './routes/AppRoutes.jsx';
import { Toast } from './components/Toast.jsx';
import { createAppStore } from './store/store.js';

export function App() {
  const store = useMemo(() => createAppStore(), []);
  useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
  const { app } = store;
  useEffect(() => { app.init(); return () => app.destroy(); }, [app]);
  return <>
    <AppRoutes app={app} />
    <Toast
      message={app.imageToast}
      type={app.imageToastType}
      version={app.imageToastVersion}
      announce={app.imageToastAnnounce}
      onDismiss={() => app.dismissToast()}
      returnFocus={() => {
        if (!app.user) document.getElementById('username')?.focus();
        else if (app.detailOpen) app.$refs.detailHeading?.focus();
        else (document.getElementById('website-image-editor-heading') ?? app.$refs.search ?? document.getElementById('website-images-heading'))?.focus();
      }}
    />
  </>;
}
