// defineConfig aus vitest/config kennt zusätzlich den Abschnitt "test"
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import type { Plugin } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'
import { purgeCssPostcss } from './build/purge-css.mjs'

/**
 * Die Betrachter-Seite für Lese-Links soll Freunden keine App installieren:
 * Manifest und Service-Worker-Registrierung dort wieder entfernen.
 */
const shareWithoutPwa: Plugin = {
  name: 'nww-share-ohne-pwa',
  enforce: 'post',
  generateBundle(_, bundle) {
    const page = bundle['share.html']
    if (page?.type !== 'asset' || typeof page.source !== 'string') return
    page.source = page.source
      .replace(/<link rel="manifest"[^>]*>/g, '')
      .replace(/<script id="vite-plugin-pwa:register-sw"[^>]*><\/script>/g, '')
  }
}

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

export default defineConfig(({ command }) => ({
  // Beim Bauen ungenutzte Bootstrap-/Icon-Regeln entfernen (spart rund 220 KB beim App-Start).
  // Im Entwicklungsmodus nicht – dort sollen neue Klassen sofort funktionieren.
  css: {
    postcss: {
      plugins:
        command === 'build'
          ? [
              purgeCssPostcss({
                content: ['src', 'index.html', 'share.html', 'node_modules/bootstrap/dist/js/bootstrap.bundle.js'],
                // Klassen, deren Namen erst zur Laufzeit zusammengesetzt werden (`alert-${typ}`)
                safelist: [/^alert-/]
              })
            ]
          : []
    }
  },
  // Relative Pfade: App läuft in jedem Ordner (Tiny-Server, GitHub Pages, USB-Stick …)
  base: './',
  // Versionsnummer aus package.json in der App verfügbar machen
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    vue(),
    // Service Worker + Manifest: App ist installierbar und läuft offline.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Nix wie weg',
        short_name: 'Nix wie weg',
        description: 'Reisen planen, erleben, festhalten und teilen – auch offline.',
        lang: 'de',
        theme_color: '#0d6efd',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }]
      },
      workbox: {
        // nur woff2 – alle unterstützten Browser nutzen es, die alte woff-Datei wäre nur Ballast im Offline-Speicher
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        // Lese-Links (/s/<code>) und die Schnittstelle nie durch die App-Startseite ersetzen
        navigateFallbackDenylist: [/\/s\/[A-Za-z0-9_-]+$/, /\/api\//],
        runtimeCaching: [
          {
            // Angesehene Kartenkacheln für unterwegs merken (kein Massen-Download – OSM-Nutzungsregeln)
            urlPattern: /^https:\/\/tile\.openstreetmap\.org\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-kacheln',
              expiration: { maxEntries: 800, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    }),
    shareWithoutPwa
  ],
  build: {
    rollupOptions: {
      // Zwei Seiten: die App und die Betrachter-Seite für Lese-Links
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        share: fileURLToPath(new URL('./share.html', import.meta.url))
      }
    }
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
}))
