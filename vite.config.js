import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script',
      // We ship a static /public/manifest.json ourselves (linked directly in
      // index.html) instead of letting the plugin generate + inject one —
      // Vercel's default static file serving maps .json to a clean
      // application/json content type, whereas the plugin's generated
      // manifest.webmanifest has tripped up MIME-type sniffing on some hosts
      // and silently killed the install prompt.
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,json}'],
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        // The 14 pad mp3s are ~4.7MB each (~66MB total) — precaching all of
        // them at service-worker install time would bloat/slow (or outright
        // fail) the install step that installability depends on, so they
        // stay out of the precache manifest. They're still made available
        // offline two ways: lazily via this CacheFirst runtime cache as each
        // pad is played, and in bulk via the in-app "Cache 14 Pads Offline"
        // button (src/lib/cachePads.js), which the user opts into explicitly.
        runtimeCaching: [
          {
            urlPattern: /\/audio\/.*\.mp3$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'rtn-worship-pads-v1',
              expiration: { maxEntries: 14, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
})
