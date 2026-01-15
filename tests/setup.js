/* eslint-disable no-undef */
import { vi, beforeEach, afterEach, afterAll } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the HTML template once (shared across tests)
const html = fs.readFileSync(path.resolve(__dirname, '../src/index.html'), 'utf8');

// Store original globals for cleanup
let originalDocument;
let originalWindow;
let currentDom = null;

beforeEach(() => {
    // Clean up previous DOM if it exists to prevent memory leaks
    if (currentDom && currentDom.window) {
        currentDom.window.close();
        currentDom = null;
    }

    // Create a fresh DOM for each test
    currentDom = new JSDOM(html, {
        url: 'http://localhost:3000',
        pretendToBeVisual: true,
        runScripts: 'outside-only',
    });

    const dom = currentDom;

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
    global.KeyboardEvent = dom.window.KeyboardEvent;
    global.MouseEvent = dom.window.MouseEvent;
    global.InputEvent = dom.window.InputEvent;

    // Mock fetch
    global.fetch = vi.fn();

    // Mock clipboard
    global.navigator.clipboard = {
        writeText: vi.fn().mockResolvedValue(undefined),
        readText: vi.fn().mockResolvedValue(''),
    };

    // Mock alert
    global.alert = vi.fn();

    // Mock localStorage
    const localStorageMock = (() => {
        let store = {};
        return {
            getItem: vi.fn(key => store[key] || null),
            setItem: vi.fn((key, value) => {
                store[key] = value.toString();
            }),
            removeItem: vi.fn(key => {
                delete store[key];
            }),
            clear: vi.fn(() => {
                store = {};
            }),
            get length() {
                return Object.keys(store).length;
            },
            key: vi.fn(index => Object.keys(store)[index] || null),
        };
    })();

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

    // Mock console methods for cleaner test output
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
    // Clear all timers to prevent memory leaks
    vi.clearAllTimers();
    vi.clearAllMocks();
    vi.restoreAllMocks(); // CRITICAL: Restore console spies and other mocks to prevent memory leaks

    // Reset module-level state to prevent memory accumulation
    // These are wrapped in try-catch since modules may not be loaded in all tests
    try {
        const { __resetForTesting: resetOCR } = await import('../src/modules/ocr.ts');
        resetOCR?.();
    } catch {
        // Module not loaded in this test, skip
    }
    try {
        const { destroyAllCharts } = await import('../src/modules/charts.ts');
        destroyAllCharts?.();
    } catch {
        // Module not loaded in this test, skip
    }
    try {
        const { clearDetectionCache } = await import('../src/modules/computer-vision.ts');
        clearDetectionCache?.();
    } catch {
        // Module not loaded in this test, skip
    }

    vi.resetModules();

    // Close the current DOM window to free memory
    if (currentDom && currentDom.window) {
        currentDom.window.close();
        currentDom = null;
    }

    // Restore originals
    if (originalDocument) global.document = originalDocument;
    if (originalWindow) global.window = originalWindow;
});

// Final cleanup after all tests in a file
afterAll(() => {
    if (currentDom && currentDom.window) {
        currentDom.window.close();
        currentDom = null;
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
