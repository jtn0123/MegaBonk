// MegaBonk Guide - Service Worker for offline support
// Bug fix: Added missing changelog.js to cache
// Bug fix: Use network-first strategy for data files to prevent stale cache
const CACHE_NAME = 'megabonk-guide-v1.0.0-2026-01-09';

// Static assets - use cache-first strategy (rarely change)
const staticAssets = [
    './',
    './index.html',
    './styles.css',
    './script.js',
    './modules/constants.js',
    './modules/utils.js',
    './modules/dom-cache.js',
    './modules/toast.js',
    './modules/favorites.js',
    './modules/data-validation.js',
    './modules/data-service.js',
    './modules/filters.js',
    './modules/match-badge.js',
    './modules/charts.js',
    './modules/renderers.js',
    './modules/modal.js',
    './modules/build-planner.js',
    './modules/compare.js',
    './modules/calculator.js',
    './modules/changelog.js',
    './modules/events.js',
    './modules/chart-loader.js',
    './manifest.json',
];

// Data files - use network-first strategy (may change between SW updates)
const dataFiles = [
    '../data/items.json',
    '../data/weapons.json',
    '../data/tomes.json',
    '../data/characters.json',
    '../data/shrines.json',
    '../data/stats.json',
    '../data/changelog.json',
];

const urlsToCache = [...staticAssets, ...dataFiles];

// Check if URL is a data file (for network-first strategy)
function isDataFile(url) {
    return url.includes('/data/') && url.endsWith('.json');
}

// Install event - cache files
self.addEventListener('install', event => {
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches
            .keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== CACHE_NAME) {
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch event - use different strategies based on resource type
self.addEventListener('fetch', event => {
    const url = event.request.url;

    // Data files: network-first, cache-fallback (always get fresh data when online)
    if (isDataFile(url)) {
        event.respondWith(
            fetch(event.request)
                .then(fetchResponse => {
                    // Update cache with fresh response
                    return caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, fetchResponse.clone()).catch(err => {
                            console.warn('Failed to cache data file:', err);
                        });
                        return fetchResponse;
                    });
                })
                .catch(() => {
                    // Network failed, fall back to cache
                    return caches.match(event.request);
                })
        );
        return;
    }

    // Static assets: cache-first, network-fallback
    event.respondWith(
        caches
            .match(event.request)
            .then(response => {
                // Return cached version or fetch from network
                return (
                    response ||
                    fetch(event.request).then(fetchResponse => {
                        // Cache new responses
                        return caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, fetchResponse.clone()).catch(err => {
                                console.warn('Failed to cache response:', err);
                            });
                            return fetchResponse;
                        });
                    })
                );
            })
            .catch(error => {
                // Offline fallback
                console.warn('Fetch failed for:', event.request.url, error);
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
                // For non-navigation requests, log but let fail gracefully
                // (browser will handle missing resources)
            })
    );
});

// Message event - handle skip waiting
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
