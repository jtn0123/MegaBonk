/**
 * Tests for offline-ui.ts module
 * Tests offline UI indicators and cached data display
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('../../src/modules/utils.ts', () => ({
    safeGetElementById: vi.fn((id: string) => document.getElementById(id)),
}));

import {
    recordDataSync,
    getLastSyncTime,
    formatRelativeTime,
    createOfflineIndicator,
    updateOfflineIndicator,
    setupOfflineListeners,
} from '../../src/modules/offline-ui.ts';
import { ToastManager } from '../../src/modules/toast.ts';
import { logger } from '../../src/modules/logger.ts';

describe('offline-ui - recordDataSync', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('should store timestamp in localStorage', () => {
        const beforeTime = Date.now();
        recordDataSync();
        const afterTime = Date.now();

        const stored = localStorage.getItem('megabonk_last_sync');
        expect(stored).not.toBeNull();

        const timestamp = parseInt(stored!, 10);
        expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
        expect(timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should log debug message on success', () => {
        recordDataSync();

        expect(logger.debug).toHaveBeenCalledWith(
            expect.objectContaining({
                operation: 'offline.sync_recorded',
            })
        );
    });

    it('should handle localStorage errors gracefully', () => {
        const originalSetItem = localStorage.setItem;
        localStorage.setItem = vi.fn(() => {
            throw new Error('Storage full');
        });

        expect(() => recordDataSync()).not.toThrow();

        expect(logger.debug).toHaveBeenCalledWith(
            expect.objectContaining({
                operation: 'offline.sync_record_failed',
            })
        );

        localStorage.setItem = originalSetItem;
    });
});

describe('offline-ui - getLastSyncTime', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it('should return null when no sync recorded', () => {
        const result = getLastSyncTime();
        expect(result).toBeNull();
    });

    it('should return stored timestamp', () => {
        localStorage.setItem('megabonk_last_sync', '1704067200000');

        const result = getLastSyncTime();
        expect(result).toBe(1704067200000);
    });

    it('should handle localStorage errors gracefully', () => {
        const mockGetItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('Storage unavailable');
        });

        const result = getLastSyncTime();
        expect(result).toBeNull();

        mockGetItem.mockRestore();
    });
});

describe('offline-ui - formatRelativeTime', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should return "just now" for very recent timestamps', () => {
        const now = Date.now();
        const result = formatRelativeTime(now - 30000); // 30 seconds ago
        expect(result).toBe('just now');
    });

    it('should return "1 minute ago" for 1 minute', () => {
        const now = Date.now();
        const result = formatRelativeTime(now - 60000); // 1 minute ago
        expect(result).toBe('1 minute ago');
    });

    it('should return "X minutes ago" for multiple minutes', () => {
        const now = Date.now();
        const result = formatRelativeTime(now - 5 * 60000); // 5 minutes ago
        expect(result).toBe('5 minutes ago');
    });

    it('should return "1 hour ago" for 1 hour', () => {
        const now = Date.now();
        const result = formatRelativeTime(now - 3600000); // 1 hour ago
        expect(result).toBe('1 hour ago');
    });

    it('should return "X hours ago" for multiple hours', () => {
        const now = Date.now();
        const result = formatRelativeTime(now - 3 * 3600000); // 3 hours ago
        expect(result).toBe('3 hours ago');
    });

    it('should return "1 day ago" for 1 day', () => {
        const now = Date.now();
        const result = formatRelativeTime(now - 24 * 3600000); // 1 day ago
        expect(result).toBe('1 day ago');
    });

    it('should return "X days ago" for multiple days', () => {
        const now = Date.now();
        const result = formatRelativeTime(now - 5 * 24 * 3600000); // 5 days ago
        expect(result).toBe('5 days ago');
    });
});

describe('offline-ui - createOfflineIndicator', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should create indicator element', () => {
        const indicator = createOfflineIndicator();

        expect(indicator).toBeTruthy();
        expect(indicator.id).toBe('offline-indicator');
        expect(indicator.className).toBe('offline-indicator');
    });

    it('should add ARIA attributes for accessibility', () => {
        const indicator = createOfflineIndicator();

        expect(indicator.getAttribute('role')).toBe('status');
        expect(indicator.getAttribute('aria-live')).toBe('polite');
    });

    it('should prepend indicator to body', () => {
        createOfflineIndicator();

        expect(document.body.firstElementChild?.id).toBe('offline-indicator');
    });

    it('should return existing indicator if already present', () => {
        const first = createOfflineIndicator();
        const second = createOfflineIndicator();

        expect(first).toBe(second);
        expect(document.querySelectorAll('#offline-indicator').length).toBe(1);
    });

    it('should hide indicator initially', () => {
        const indicator = createOfflineIndicator();
        expect(indicator.style.display).toBe('none');
    });
});

describe('offline-ui - updateOfflineIndicator', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();

        document.body.innerHTML = '<div id="offline-indicator" style="display: none;"></div>';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should show indicator when offline', () => {
        updateOfflineIndicator(true);

        const indicator = document.getElementById('offline-indicator');
        expect(indicator?.style.display).toBe('flex');
    });

    it('should hide indicator when online', () => {
        updateOfflineIndicator(true);
        updateOfflineIndicator(false);

        const indicator = document.getElementById('offline-indicator');
        expect(indicator?.style.display).toBe('none');
    });

    it('should display offline message', () => {
        updateOfflineIndicator(true);

        const indicator = document.getElementById('offline-indicator');
        expect(indicator?.innerHTML).toContain("You're offline");
    });

    it('should include last sync time in message when available', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));

        localStorage.setItem('megabonk_last_sync', String(Date.now() - 3600000)); // 1 hour ago

        updateOfflineIndicator(true);

        const indicator = document.getElementById('offline-indicator');
        expect(indicator?.innerHTML).toContain('1 hour ago');

        vi.useRealTimers();
    });

    it('should include retry button', () => {
        updateOfflineIndicator(true);

        const retryBtn = document.querySelector('.offline-retry-btn');
        expect(retryBtn).toBeTruthy();
    });

    it('should handle retry click when back online', () => {
        Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

        updateOfflineIndicator(true);

        const retryBtn = document.querySelector('.offline-retry-btn') as HTMLButtonElement;
        retryBtn?.click();

        expect(ToastManager.success).toHaveBeenCalledWith('Back online!');
    });

    it('should handle retry click when still offline', () => {
        Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

        updateOfflineIndicator(true);

        const retryBtn = document.querySelector('.offline-retry-btn') as HTMLButtonElement;
        retryBtn?.click();

        expect(ToastManager.info).toHaveBeenCalledWith('Still offline. Please check your connection.');
    });

    it('should call window.loadAllData on successful retry', () => {
        Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
        (window as any).loadAllData = vi.fn();

        updateOfflineIndicator(true);

        const retryBtn = document.querySelector('.offline-retry-btn') as HTMLButtonElement;
        retryBtn?.click();

        expect((window as any).loadAllData).toHaveBeenCalled();

        delete (window as any).loadAllData;
    });

    it('should handle missing indicator element', () => {
        document.body.innerHTML = '';

        expect(() => updateOfflineIndicator(true)).not.toThrow();
    });
});

describe('offline-ui - setupOfflineListeners', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should create offline indicator', () => {
        setupOfflineListeners();

        const indicator = document.getElementById('offline-indicator');
        expect(indicator).toBeTruthy();
    });

    it('should add online event listener', () => {
        const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

        setupOfflineListeners();

        expect(addEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
    });

    it('should add offline event listener', () => {
        const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

        setupOfflineListeners();

        expect(addEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));
    });

    it('should show indicator when initially offline', () => {
        Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

        setupOfflineListeners();

        const indicator = document.getElementById('offline-indicator');
        expect(indicator?.style.display).toBe('flex');
    });

    it('should hide indicator when initially online', () => {
        Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

        setupOfflineListeners();

        const indicator = document.getElementById('offline-indicator');
        expect(indicator?.style.display).toBe('none');
    });

    it('should handle online event', () => {
        Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

        setupOfflineListeners();

        window.dispatchEvent(new Event('online'));

        expect(ToastManager.success).toHaveBeenCalledWith('Back online!');
        expect(logger.info).toHaveBeenCalledWith(
            expect.objectContaining({
                operation: 'app.online',
            })
        );
    });

    it('should handle offline event', () => {
        setupOfflineListeners();

        window.dispatchEvent(new Event('offline'));

        expect(logger.info).toHaveBeenCalledWith(
            expect.objectContaining({
                operation: 'app.offline',
            })
        );
    });

    it('should record sync on coming back online', () => {
        setupOfflineListeners();

        const beforeTime = Date.now();
        window.dispatchEvent(new Event('online'));
        const afterTime = Date.now();

        const stored = localStorage.getItem('megabonk_last_sync');
        expect(stored).not.toBeNull();

        const timestamp = parseInt(stored!, 10);
        expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
        expect(timestamp).toBeLessThanOrEqual(afterTime);
    });
});

// Note: Global exports are tested implicitly through module imports
// The actual window attachment happens at module load time in browser environment
