import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const projectRoot = path.resolve(import.meta.dirname, '..');

function connectSrcPolicy(apiBaseUrl) {
  const raw = (apiBaseUrl || '').trim();
  if (raw) {
    try {
      return `'self' ${new URL(raw).origin}`;
    } catch { /* Fallback below. */ }
  }
  return `'self' http://api.localhost:8094 https:`;
}

function cspPlugin(apiBaseUrl) {
  return {
    name: 'sptc-csp-connect-src',
    transformIndexHtml(html) {
      return html.replace('__CONNECT_SRC__', connectSrcPolicy(apiBaseUrl));
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, 'VITE_');
  const apiBaseUrl = process.env.VITE_API_BASE_URL || env.VITE_API_BASE_URL || '';
  return {
    root: 'admin',
    envDir: projectRoot,
    envPrefix: 'VITE_',
    base: './',
    esbuild: { jsx: 'automatic' },
    plugins: [react(), tailwindcss(), cspPlugin(apiBaseUrl)],
    build: { outDir: '../../public/admin', emptyOutDir: false },
  };
});
