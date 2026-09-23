import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';
import { jsonPersistPlugin } from './src/plugins/json-persist';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    jsonPersistPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Mariage — Gestion des invités',
        short_name: 'Mariage',
        description: "Gestion d'invités de mariage — 100% locale et hors ligne",
        theme_color: '#1c1915',
        background_color: '#fdfaf3',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        lang: 'fr',
        icons: [],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    include: ['jsqr'],
    exclude: ['lucide-react'],
  },
});
