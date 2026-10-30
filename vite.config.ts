import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

// GitHub Pages serveert de app onder /<repo>/. Lokaal is dat gewoon '/'.
// Als claude.ai-Artifact (mode "artifact") worden alle bestanden relatief geladen en is er geen service worker.
export default defineConfig(({ mode }) => {
  const artifact = mode === 'artifact';
  const base = artifact ? './' : (process.env.BASE_PATH ?? '/');
  return {
    base,
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
    },
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    build: {
      outDir: artifact ? 'dist-artifact' : 'dist',
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            data: ['dexie', 'dexie-react-hooks', 'zod', 'uuid'],
            ...(artifact ? {} : { supabase: ['@supabase/supabase-js'] }),
          },
        },
      },
    },
    plugins: [
      react(),
      VitePWA({
        // In de artifact draait de app binnen Claude: geen manifest of service worker.
        disable: artifact,
        registerType: 'prompt',
        injectRegister: false,
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'Our Network',
          short_name: 'Our Network',
          description: 'Onze mensen. Onze momenten. Ons verhaal.',
          lang: 'nl-BE',
          theme_color: '#101418',
          background_color: '#101418',
          display: 'standalone',
          orientation: 'any',
          start_url: base,
          scope: base,
          icons: [
            { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // Alleen de app-shell en statische assets. Geen Supabase-/API-responses en geen foto's:
          // persoonsgegevens staan enkel in de lokale database van de ingelogde gebruiker.
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          navigateFallback: `${base}index.html`,
          runtimeCaching: [],
          cleanupOutdatedCaches: true,
        },
      }),
    ],
  };
});
