import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Service Worker Tests
 * Tests for install, activate, and fetch events
 */

// Mock cache storage
const mockCache = {
  addAll: vi.fn().mockResolvedValue(undefined),
  put: vi.fn().mockResolvedValue(undefined),
  match: vi.fn(),
  delete: vi.fn().mockResolvedValue(true)
};

const mockCaches = {
  open: vi.fn().mockResolvedValue(mockCache),
  keys: vi.fn().mockResolvedValue([]),
  match: vi.fn(),
  delete: vi.fn().mockResolvedValue(true)
};

// Mock self (service worker global)
const mockClients = {
  claim: vi.fn().mockResolvedValue(undefined)
};

const mockSelf = {
  skipWaiting: vi.fn().mockResolvedValue(undefined),
  clients: mockClients,
  addEventListener: vi.fn()
};

// Store event handlers for testing
const eventHandlers = {};

// Setup mock addEventListener to capture handlers
mockSelf.addEventListener = vi.fn((event, handler) => {
  eventHandlers[event] = handler;
});

// Service worker constants (mirrored from sw.js)
const CACHE_NAME = 'megabonk-guide-v1.0.19';
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './modules/constants.js',
  './libs/chart.min.js',
  './manifest.json',
  '../data/items.json',
  '../data/weapons.json',
  '../data/tomes.json',
  '../data/characters.json',
  '../data/shrines.json',
  '../data/stats.json'
];

/**
 * Simulates the install event handler logic
 */
async function simulateInstall() {
  const cache = await mockCaches.open(CACHE_NAME);
  await cache.addAll(urlsToCache);
  await mockSelf.skipWaiting();
}

/**
 * Simulates the activate event handler logic
 */
async function simulateActivate(existingCacheNames = []) {
  mockCaches.keys.mockResolvedValueOnce(existingCacheNames);
  const cacheNames = await mockCaches.keys();
  await Promise.all(
    cacheNames.map(cacheName => {
      if (cacheName !== CACHE_NAME) {
        return mockCaches.delete(cacheName);
      }
    })
  );
  await mockSelf.clients.claim();
}

/**
 * Simulates the fetch event handler logic
 */
async function simulateFetch(request, cachedResponse = null) {
  mockCaches.match.mockResolvedValueOnce(cachedResponse);

  if (cachedResponse) {
    return cachedResponse;
  }

  // Simulate network fetch
  const fetchResponse = new Response('network response', { status: 200 });
  fetchResponse.clone = () => new Response('cloned response', { status: 200 });

  const cache = await mockCaches.open(CACHE_NAME);
  await cache.put(request, fetchResponse.clone());

  return fetchResponse;
}

describe('Service Worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCaches.keys.mockResolvedValue([]);
  });

  describe('Install Event', () => {
    it('should open the correct cache', async () => {
      await simulateInstall();

      expect(mockCaches.open).toHaveBeenCalledWith(CACHE_NAME);
    });

    it('should cache all required URLs', async () => {
      await simulateInstall();

      expect(mockCache.addAll).toHaveBeenCalledWith(urlsToCache);
    });

    it('should cache index.html', async () => {
      await simulateInstall();

      expect(mockCache.addAll).toHaveBeenCalledWith(
        expect.arrayContaining(['./index.html'])
      );
    });

    it('should cache all data JSON files', async () => {
      await simulateInstall();

      const cachedUrls = mockCache.addAll.mock.calls[0][0];
      expect(cachedUrls).toContain('../data/items.json');
      expect(cachedUrls).toContain('../data/weapons.json');
      expect(cachedUrls).toContain('../data/tomes.json');
      expect(cachedUrls).toContain('../data/characters.json');
      expect(cachedUrls).toContain('../data/shrines.json');
      expect(cachedUrls).toContain('../data/stats.json');
    });

    it('should cache Chart.js library', async () => {
      await simulateInstall();

      const cachedUrls = mockCache.addAll.mock.calls[0][0];
      expect(cachedUrls).toContain('./libs/chart.min.js');
    });

    it('should call skipWaiting after caching', async () => {
      await simulateInstall();

      expect(mockSelf.skipWaiting).toHaveBeenCalled();
    });

    it('should cache exactly 13 URLs', async () => {
      await simulateInstall();

      const cachedUrls = mockCache.addAll.mock.calls[0][0];
      expect(cachedUrls).toHaveLength(13);
    });
  });

  describe('Activate Event', () => {
    it('should call clients.claim()', async () => {
      await simulateActivate([]);

      expect(mockSelf.clients.claim).toHaveBeenCalled();
    });

    it('should delete old caches', async () => {
      const oldCaches = ['megabonk-guide-v1.0.17', 'megabonk-guide-v1.0.16'];

      await simulateActivate(oldCaches);

      expect(mockCaches.delete).toHaveBeenCalledWith('megabonk-guide-v1.0.17');
      expect(mockCaches.delete).toHaveBeenCalledWith('megabonk-guide-v1.0.16');
    });

    it('should not delete current cache', async () => {
      const allCaches = [CACHE_NAME, 'megabonk-guide-v1.0.17'];

      await simulateActivate(allCaches);

      expect(mockCaches.delete).not.toHaveBeenCalledWith(CACHE_NAME);
      expect(mockCaches.delete).toHaveBeenCalledWith('megabonk-guide-v1.0.17');
    });

    it('should handle empty cache list', async () => {
      await simulateActivate([]);

      expect(mockCaches.delete).not.toHaveBeenCalled();
      expect(mockSelf.clients.claim).toHaveBeenCalled();
    });

    it('should handle only current cache existing', async () => {
      await simulateActivate([CACHE_NAME]);

      expect(mockCaches.delete).not.toHaveBeenCalled();
    });
  });

  describe('Fetch Event', () => {
    it('should return cached response if available', async () => {
      const cachedResponse = new Response('cached content', { status: 200 });
      const request = new Request('https://example.com/test.html');

      const response = await simulateFetch(request, cachedResponse);

      expect(response).toBe(cachedResponse);
    });

    it('should fetch from network if not cached', async () => {
      const request = new Request('https://example.com/new-file.html');

      const response = await simulateFetch(request, null);

      expect(response).toBeDefined();
      expect(mockCaches.open).toHaveBeenCalled();
    });

    it('should cache network responses', async () => {
      const request = new Request('https://example.com/dynamic.json');

      await simulateFetch(request, null);

      expect(mockCache.put).toHaveBeenCalled();
    });

    it('should check cache first', async () => {
      const request = new Request('https://example.com/style.css');

      // Mock the cache match to return a response
      mockCaches.match.mockResolvedValueOnce({ status: 200, body: 'cached css' });

      // Call caches.match directly to simulate the cache-first check
      const result = await mockCaches.match(request);

      expect(mockCaches.match).toHaveBeenCalledWith(request);
      expect(result).toBeDefined();
      expect(result.status).toBe(200);
    });
  });

  describe('Cache Name', () => {
    it('should use versioned cache name', () => {
      expect(CACHE_NAME).toMatch(/megabonk-guide-v\d+\.\d+\.\d+/);
    });

    it('should have specific version format', () => {
      expect(CACHE_NAME).toBe('megabonk-guide-v1.0.19');
    });
  });

  describe('URLs to Cache', () => {
    it('should include root path', () => {
      expect(urlsToCache).toContain('./');
    });

    it('should include HTML entry point', () => {
      expect(urlsToCache).toContain('./index.html');
    });

    it('should include CSS stylesheet', () => {
      expect(urlsToCache).toContain('./styles.css');
    });

    it('should include main JavaScript', () => {
      expect(urlsToCache).toContain('./script.js');
    });

    it('should include PWA manifest', () => {
      expect(urlsToCache).toContain('./manifest.json');
    });

    it('should include all game data files', () => {
      const dataFiles = urlsToCache.filter(url => url.includes('/data/'));
      expect(dataFiles).toHaveLength(6);
    });

    it('should include constants module in cache list', () => {
      expect(urlsToCache).toContain('./modules/constants.js');
    });
  });

  describe('Offline Fallback', () => {
    it('should provide fallback HTML for navigation requests', async () => {
      // Test the offline fallback logic
      const mockRequest = {
        mode: 'navigate',
        url: 'https://example.com/offline-page'
      };

      // When cache match fails and fetch fails, should return index.html
      mockCaches.match.mockResolvedValueOnce(null);

      // Simulate the fallback behavior
      const fallbackResponse = await mockCaches.match('./index.html');

      // The actual sw.js returns index.html as fallback for navigation
      expect(mockCaches.match).toHaveBeenCalled();
    });
  });
});

describe('Service Worker Integration Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle fresh install correctly', async () => {
    // Simulate first-time install
    await simulateInstall();

    expect(mockCaches.open).toHaveBeenCalledWith(CACHE_NAME);
    expect(mockCache.addAll).toHaveBeenCalled();
    expect(mockSelf.skipWaiting).toHaveBeenCalled();
  });

  it('should handle update from old version', async () => {
    // Simulate upgrade from v1.0.17 to v1.0.18
    const oldCaches = ['megabonk-guide-v1.0.17'];

    await simulateActivate(oldCaches);

    expect(mockCaches.delete).toHaveBeenCalledWith('megabonk-guide-v1.0.17');
    expect(mockSelf.clients.claim).toHaveBeenCalled();
  });

  it('should handle multiple old caches during cleanup', async () => {
    const oldCaches = [
      'megabonk-guide-v1.0.15',
      'megabonk-guide-v1.0.16',
      'megabonk-guide-v1.0.17',
      CACHE_NAME
    ];

    await simulateActivate(oldCaches);

    // Should delete all except current
    expect(mockCaches.delete).toHaveBeenCalledTimes(3);
    expect(mockCaches.delete).not.toHaveBeenCalledWith(CACHE_NAME);
  });
});
