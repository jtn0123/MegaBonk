import { vi, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the HTML template
const html = fs.readFileSync(
  path.resolve(__dirname, '../src/index.html'),
  'utf8'
);

// Store original globals for cleanup
let originalDocument;
let originalWindow;

beforeEach(() => {
  // Create a fresh DOM for each test
  const dom = new JSDOM(html, {
    url: 'http://localhost:3000',
    pretendToBeVisual: true,
    runScripts: 'outside-only'
  });

  // Store originals
  originalDocument = global.document;
  originalWindow = global.window;

  // Set up globals
  global.document = dom.window.document;
  global.window = dom.window;
  global.navigator = dom.window.navigator;
  global.HTMLElement = dom.window.HTMLElement;
  global.Event = dom.window.Event;
  global.CustomEvent = dom.window.CustomEvent;

  // Mock fetch
  global.fetch = vi.fn();

  // Mock clipboard
  global.navigator.clipboard = {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue('')
  };

  // Mock alert
  global.alert = vi.fn();

  // Mock localStorage
  const localStorageMock = (() => {
    let store = {};
    return {
      getItem: vi.fn((key) => store[key] || null),
      setItem: vi.fn((key, value) => { store[key] = value.toString(); }),
      removeItem: vi.fn((key) => { delete store[key]; }),
      clear: vi.fn(() => { store = {}; }),
      get length() { return Object.keys(store).length; },
      key: vi.fn((index) => Object.keys(store)[index] || null)
    };
  })();

  // Define localStorage on both global and window using Object.defineProperty
  Object.defineProperty(global, 'localStorage', {
    value: localStorageMock,
    writable: true,
    configurable: true
  });

  Object.defineProperty(dom.window, 'localStorage', {
    value: localStorageMock,
    writable: true,
    configurable: true
  });

  // Mock service worker
  global.navigator.serviceWorker = {
    register: vi.fn().mockResolvedValue({
      update: vi.fn(),
      unregister: vi.fn().mockResolvedValue(true)
    }),
    ready: Promise.resolve({
      active: null
    })
  };

  // Mock console methods for cleaner test output
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();

  // Restore originals
  if (originalDocument) global.document = originalDocument;
  if (originalWindow) global.window = originalWindow;
});

// Helper to reset global application state
export function resetAppState() {
  return {
    allData: {
      items: null,
      weapons: null,
      tomes: null,
      characters: null,
      shrines: null,
      stats: null
    },
    currentTab: 'items',
    filteredData: [],
    currentBuild: {
      character: null,
      weapon: null,
      tomes: [],
      items: []
    },
    compareItems: []
  };
}
