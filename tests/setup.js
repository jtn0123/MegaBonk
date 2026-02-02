/* eslint-disable no-undef */
import { vi, beforeEach, afterEach, afterAll } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ========================================
// Auto-Mock Common Modules
// ========================================
// These mocks are applied globally to all tests to reduce boilerplate.
// Tests can override these with vi.mock() if needed.

// Logger mock - prevents console noise and allows spy assertions
vi.mock('../src/modules/logger.ts', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        setContext: vi.fn(),
    },
}));

// Toast mock - prevents UI side effects
vi.mock('../src/modules/toast.ts', () => ({
    ToastManager: {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        reset: vi.fn(),
    },
}));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the HTML template once (shared across tests)
const html = fs.readFileSync(path.resolve(__dirname, '../src/index.html'), 'utf8');

// Parse out just the body content for fast reset
const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
const initialBodyContent = bodyMatch ? bodyMatch[1] : '';

// Create a SINGLE JSDOM instance per test file (reused across tests)
// This prevents memory accumulation from creating thousands of JSDOM instances
let sharedDom = null;
let localStorageStore = {};

function getOrCreateDom() {
    if (!sharedDom) {
        sharedDom = new JSDOM(html, {
            url: 'http://localhost:3000',
            pretendToBeVisual: true,
            runScripts: 'outside-only',
        });
    }
    return sharedDom;
}

beforeEach(async () => {
    const dom = getOrCreateDom();

    // Reset centralized state store for test isolation
    try {
        const { resetStore } = await import('../src/modules/store.ts');
        resetStore();
        // Note: Window sync is kept enabled because filters.ts uses window.isFavorite
        // and window.renderTabContent due to circular dependency constraints.
        // Test isolation is still achieved via resetStore().
    } catch {
        // Module may not exist or import may fail - ignore
    }

    // Reset body content to initial state (fast, no new JSDOM creation)
    dom.window.document.body.innerHTML = initialBodyContent;

    // Set up globals
    global.document = dom.window.document;
    global.window = dom.window;
    global.navigator = dom.window.navigator;
    global.HTMLElement = dom.window.HTMLElement;
    global.Event = dom.window.Event;
    global.CustomEvent = dom.window.CustomEvent;
    global.KeyboardEvent = dom.window.KeyboardEvent;
    global.MouseEvent = dom.window.MouseEvent;
    global.InputEvent = dom.window.InputEvent;

    // Expose AbortController and AbortSignal from jsdom for proper signal support
    global.AbortController = dom.window.AbortController;
    global.AbortSignal = dom.window.AbortSignal;

    // Mock fetch
    global.fetch = vi.fn();

    // Mock clipboard
    global.navigator.clipboard = {
        writeText: vi.fn().mockResolvedValue(undefined),
        readText: vi.fn().mockResolvedValue(''),
    };

    // Mock alert
    global.alert = vi.fn();

    // Reset localStorage store and create mock
    localStorageStore = {};
    const localStorageMock = {
        getItem: vi.fn(key => localStorageStore[key] || null),
        setItem: vi.fn((key, value) => {
            localStorageStore[key] = value.toString();
        }),
        removeItem: vi.fn(key => {
            delete localStorageStore[key];
        }),
        clear: vi.fn(() => {
            localStorageStore = {};
        }),
        get length() {
            return Object.keys(localStorageStore).length;
        },
        key: vi.fn(index => Object.keys(localStorageStore)[index] || null),
    };

    // Define localStorage on both global and window using Object.defineProperty
    Object.defineProperty(global, 'localStorage', {
        value: localStorageMock,
        writable: true,
        configurable: true,
    });

    Object.defineProperty(dom.window, 'localStorage', {
        value: localStorageMock,
        writable: true,
        configurable: true,
    });

    // Mock service worker
    global.navigator.serviceWorker = {
        register: vi.fn().mockResolvedValue({
            update: vi.fn(),
            unregister: vi.fn().mockResolvedValue(true),
        }),
        ready: Promise.resolve({
            active: null,
        }),
    };

    // Mock scrollIntoView - not available in jsdom
    dom.window.Element.prototype.scrollIntoView = vi.fn();
    dom.window.HTMLElement.prototype.scrollIntoView = vi.fn();

    // Mock matchMedia - not available in jsdom
    dom.window.matchMedia = vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    }));
    global.matchMedia = dom.window.matchMedia;

    // Mock console methods for cleaner test output
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
    // Clear all timers to prevent memory leaks
    vi.clearAllTimers();
    vi.clearAllMocks();
    vi.restoreAllMocks(); // CRITICAL: Restore console spies and other mocks to prevent memory leaks

    // ========================================
    // Module Cleanup - Prevent Memory Leaks
    // ========================================
    // Lazy import modules to handle cases where they may not exist or fail to load.
    // Each cleanup function removes event listeners, clears caches, and resets state.

    try {
        const { cleanupEventListeners } = await import('../src/modules/events.ts');
        cleanupEventListeners();
    } catch {
        // Module may not exist or import may fail - ignore
    }

    try {
        const { destroyAllCharts } = await import('../src/modules/charts.ts');
        destroyAllCharts();
    } catch {
        // Module may not exist or import may fail - ignore
    }

    try {
        const { invalidateDOMCache } = await import('../src/modules/dom-cache.ts');
        invalidateDOMCache();
    } catch {
        // Module may not exist or import may fail - ignore
    }

    try {
        const { ToastManager } = await import('../src/modules/toast.ts');
        ToastManager.reset();
    } catch {
        // Module may not exist or import may fail - ignore
    }

    try {
        const { cleanupKeyboardShortcuts } = await import('../src/modules/keyboard-shortcuts.ts');
        cleanupKeyboardShortcuts();
    } catch {
        // Module may not exist or import may fail - ignore
    }

    try {
        const { resetStore, clearSubscribers } = await import('../src/modules/store.ts');
        resetStore();
        clearSubscribers();
    } catch {
        // Module may not exist or import may fail - ignore
    }

    try {
        const { resetState } = await import('../src/modules/cv/state.ts');
        resetState();
    } catch {
        // Module may not exist or import may fail - ignore
    }

    try {
        const { cleanupCV } = await import('../src/modules/cv/core.ts');
        cleanupCV();
    } catch {
        // Module may not exist or import may fail - ignore
    }

    // NOTE: vi.resetModules() was removed because it causes memory accumulation
    // Module isolation between files is handled by vitest's isolate: true setting

    // Force garbage collection if available (run with --expose-gc)
    if (global.gc) {
        global.gc();
    }

    // Clear localStorage store
    localStorageStore = {};
});

// Final cleanup after all tests in a file - close the shared DOM
afterAll(() => {
    if (sharedDom && sharedDom.window) {
        sharedDom.window.close();
        sharedDom = null;
    }
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
            stats: null,
        },
        currentTab: 'items',
        filteredData: [],
        currentBuild: {
            character: null,
            weapon: null,
            tomes: [],
            items: [],
        },
        compareItems: [],
    };
}
