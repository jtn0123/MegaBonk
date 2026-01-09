import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  root: 'src',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: './src/index.html'
      }
    },
    // Code splitting strategy
    chunkSizeWarningLimit: 500,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false // Keep console for debugging
      }
    }
  },
  server: {
    port: 8000,
    open: true
  },
  resolve: {
    alias: {
      '@': '/src',
      '@modules': '/modules'
    }
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'MegaBonk Complete Guide',
        short_name: 'MegaBonk',
        description: 'Complete guide for MegaBonk roguelike with items, weapons, tomes, characters, build planner and calculator',
        theme_color: '#00ff88',
        background_color: '#1a1a1a',
        display: 'standalone',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,webp}'],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\.json$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'game-data-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              }
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|webp|gif)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          }
        ],
        // Clear old caches on activation
        cleanupOutdatedCaches: true,
        // Cache versioning
        cacheId: 'megabonk-v2'
      }
    })
  ]
});
