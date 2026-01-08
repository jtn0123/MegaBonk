// MegaBonk Guide - Service Worker for offline support
// Bug fix: Added missing changelog.js to cache
const CACHE_NAME = 'megabonk-guide-v1.2.1';
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './modules/constants.js',
  './modules/utils.js',
  './modules/toast.js',
  './modules/data-service.js',
  './modules/filters.js',
  './modules/charts.js',
  './modules/renderers.js',
  './modules/modal.js',
  './modules/build-planner.js',
  './modules/compare.js',
  './modules/calculator.js',
  './modules/changelog.js',
  './modules/events.js',
  './libs/chart.min.js',
  './manifest.json',
  '../data/items.json',
  '../data/weapons.json',
  '../data/tomes.json',
  '../data/characters.json',
  '../data/shrines.json',
  '../data/stats.json',
  '../data/changelog.json'
];

// Install event - cache files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version or fetch from network
        return response || fetch(event.request).then(fetchResponse => {
          // Cache new responses
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, fetchResponse.clone());
            return fetchResponse;
          });
        });
      })
      .catch(() => {
        // Offline fallback
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      })
  );
});
