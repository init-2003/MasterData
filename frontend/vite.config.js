import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  esbuild: { jsx: 'automatic' },
  plugins: [react(), tailwindcss()],
  build: { outDir: '../public', emptyOutDir: false },
});
