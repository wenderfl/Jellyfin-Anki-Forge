import { fileURLToPath, URL } from 'node:url';

import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/Plugins': {
        target: 'http://localhost:8096',
        changeOrigin: true,
      },
      '/Users': {
        target: 'http://localhost:8096',
        changeOrigin: true,
      },
    },
  },
});
