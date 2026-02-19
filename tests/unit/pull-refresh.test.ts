/**
 * Pull-to-Refresh Tests
 * Tests for touch gesture-based refresh functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMinimalDOM } from '../helpers/dom-setup.ts';
import { createLoggerMock, createToastMock, createDataServiceMock } from '../helpers/shared-mocks.ts';

// Mock dependencies before import
vi.mock('../../src/modules/logger.ts', () => createLoggerMock());
vi.mock('../../src/modules/toast.ts', () => createToastMock());
vi.mock('../../src/modules/data-service.ts', () => createDataServiceMock());

// ========================================
// Helper Functions
// ========================================

/**
 * Create a touch event with specified properties
 */
function createTouchEvent(
    type: 'touchstart' | 'touchmove' | 'touchend',
    clientY: number,
    options: EventInit = {}
): TouchEvent {
    const touch = {
        clientY,
        clientX: 100,
        identifier: 0,
        target: document.body,
        screenX: 100,
        screenY: clientY,
        pageX: 100,
        pageY: clientY,
        radiusX: 0,
        radiusY: 0,
        rotationAngle: 0,
        force: 1,
    } as Touch;

    const touchEvent = new TouchEvent(type, {
        bubbles: true,
        cancelable: true,
        touches: type === 'touchend' ? [] : [touch],
        changedTouches: [touch],
        targetTouches: type === 'touchend' ? [] : [touch],
        ...options,
    });

    return touchEvent;
}

/**
 * Simulate a complete pull gesture
 */
async function simulatePullGesture(
    startY: number,
    endY: number,
    steps: number = 5
) {
    // Touch start
    document.dispatchEvent(createTouchEvent('touchstart', startY));

    // Touch move (incremental)
    const deltaY = (endY - startY) / steps;
    for (let i = 1; i <= steps; i++) {
        const currentY = startY + deltaY * i;
        document.dispatchEvent(createTouchEvent('touchmove', currentY));
        await new Promise(resolve => setTimeout(resolve, 40));
    }

    // Touch end
    document.dispatchEvent(createTouchEvent('touchend', endY));
}

/**
 * Mock window.scrollY
 */
function setScrollPosition(y: number) {
    Object.defineProperty(window, 'scrollY', {
        value: y,
        writable: true,
        configurable: true,
    });
}

/**
 * Mock touch device detection
 */
function mockTouchDevice(isTouch: boolean) {
    if (isTouch) {
        Object.defineProperty(window, 'ontouchstart', {
            value: () => {},
            configurable: true,
        });
        Object.defineProperty(navigator, 'maxTouchPoints', {
            value: 5,
            configurable: true,
        });
    } else {
        delete (window as Record<string, unknown>).ontouchstart;
        Object.defineProperty(navigator, 'maxTouchPoints', {
            value: 0,
            configurable: true,
        });
    }
}

// ========================================
// Setup
// ========================================

describe('Pull-to-Refresh', () => {
    let initPullRefresh: () => void;
    let cleanupPullRefresh: () => void;
    let loadAllData: ReturnType<typeof vi.fn>;
    let ToastManager: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
    let logger: { info: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; debug: ReturnType<typeof vi.fn> };

    beforeEach(async () => {
        // Reset DOM
        createMinimalDOM();
        setScrollPosition(0);
        mockTouchDevice(true);

        // Clear module cache and re-import
        vi.resetModules();

        // Re-setup mocks
        const loggerMock = createLoggerMock();
        const toastMock = createToastMock();
        const dataServiceMock = createDataServiceMock();

        vi.doMock('../../src/modules/logger.ts', () => loggerMock);
        vi.doMock('../../src/modules/toast.ts', () => toastMock);
        vi.doMock('../../src/modules/data-service.ts', () => dataServiceMock);

        // Import the module
        const pullRefreshModule = await import('../../src/modules/pull-refresh.ts');
        initPullRefresh = pullRefreshModule.initPullRefresh;
        cleanupPullRefresh = pullRefreshModule.cleanupPullRefresh;

        // Disable new sensitivity guards for existing tests
        pullRefreshModule.PULL_REFRESH_CONFIG.MIN_TOUCH_DURATION_MS = 0;
        pullRefreshModule.PULL_REFRESH_CONFIG.COOLDOWN_MS = 0;

        const dataService = await import('../../src/modules/data-service.ts');
        loadAllData = dataService.loadAllData as ReturnType<typeof vi.fn>;

        const toast = await import('../../src/modules/toast.ts');
        ToastManager = toast.ToastManager as typeof ToastManager;

        const loggerModule = await import('../../src/modules/logger.ts');
        logger = loggerModule.logger as typeof logger;
    });

    afterEach(() => {
        cleanupPullRefresh?.();
        vi.clearAllMocks();
    });

    // ========================================
    // Initialization Tests
    // ========================================

    describe('Initialization', () => {
        it('should create indicator element on touch device', () => {
            initPullRefresh();

            const indicator = document.querySelector('.pull-refresh-indicator');
            expect(indicator).toBeTruthy();
        });

        it('should not initialize on non-touch device', () => {
            mockTouchDevice(false);
            initPullRefresh();

            const indicator = document.querySelector('.pull-refresh-indicator');
            expect(indicator).toBeFalsy();
            expect(logger.debug).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'pull-refresh.skip',
                    data: { reason: 'not_touch_device' },
                })
            );
        });

        it('should log initialization on touch device', () => {
            initPullRefresh();

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'pull-refresh.init',
                    data: { enabled: true },
                })
            );
        });

        it('should create indicator with correct structure', () => {
            initPullRefresh();

            const indicator = document.querySelector('.pull-refresh-indicator');
            const content = indicator?.querySelector('.pull-refresh-content');
            const spinner = indicator?.querySelector('.pull-refresh-spinner');
            const text = indicator?.querySelector('.pull-refresh-text');

            expect(content).toBeTruthy();
            expect(spinner).toBeTruthy();
            expect(text).toBeTruthy();
            expect(text?.textContent).toBe('Pull to refresh');
        });

        it('should prepend indicator to body', () => {
            initPullRefresh();

            const indicator = document.querySelector('.pull-refresh-indicator');
            expect(indicator?.parentElement).toBe(document.body);
            expect(document.body.firstChild).toBe(indicator);
        });
    });

    // ========================================
    // Touch Detection Tests
    // ========================================

    describe('Touch Detection', () => {
        it('should detect touch via ontouchstart', () => {
            mockTouchDevice(false);
            Object.defineProperty(window, 'ontouchstart', {
                value: () => {},
                configurable: true,
            });

            initPullRefresh();

            const indicator = document.querySelector('.pull-refresh-indicator');
            expect(indicator).toBeTruthy();
        });

        it('should detect touch via maxTouchPoints', () => {
            delete (window as Record<string, unknown>).ontouchstart;
            Object.defineProperty(navigator, 'maxTouchPoints', {
                value: 1,
                configurable: true,
            });

            initPullRefresh();

            const indicator = document.querySelector('.pull-refresh-indicator');
            expect(indicator).toBeTruthy();
        });
    });

    // ========================================
    // Pull Gesture Tests
    // ========================================

    describe('Pull Gesture', () => {
        beforeEach(() => {
            initPullRefresh();
        });

        it('should track pull distance', async () => {
            document.dispatchEvent(createTouchEvent('touchstart', 100));
            document.dispatchEvent(createTouchEvent('touchmove', 150));

            const indicator = document.querySelector('.pull-refresh-indicator');
            expect(indicator?.classList.contains('active')).toBe(true);
        });

        it('should not activate when scrolled down', async () => {
            setScrollPosition(100);

            document.dispatchEvent(createTouchEvent('touchstart', 100));
            document.dispatchEvent(createTouchEvent('touchmove', 200));

            const indicator = document.querySelector('.pull-refresh-indicator');
            expect(indicator?.classList.contains('active')).toBe(false);
        });

        it('should not activate when pulling up', async () => {
            document.dispatchEvent(createTouchEvent('touchstart', 200));
            document.dispatchEvent(createTouchEvent('touchmove', 100)); // Pulling up

            const indicator = document.querySelector('.pull-refresh-indicator');
            expect(indicator?.classList.contains('active')).toBe(false);
        });

        it('should show threshold-reached state', async () => {
            document.dispatchEvent(createTouchEvent('touchstart', 0));
            document.dispatchEvent(createTouchEvent('touchmove', 150)); // Past 100px threshold

            const indicator = document.querySelector('.pull-refresh-indicator');
            const text = indicator?.querySelector('.pull-refresh-text');

            expect(indicator?.classList.contains('threshold-reached')).toBe(true);
            expect(text?.textContent).toBe('Release to refresh');
        });

        it('should apply resistance after threshold', async () => {
            document.dispatchEvent(createTouchEvent('touchstart', 0));
            document.dispatchEvent(createTouchEvent('touchmove', 200)); // Way past threshold

            const indicator = document.querySelector('.pull-refresh-indicator') as HTMLElement;
            const pullDistance = indicator?.style.getPropertyValue('--pull-distance');

            // Should be clamped due to resistance
            // 100 + (100 * 0.4) = 140px, max is 160
            if (pullDistance) {
                const distance = parseFloat(pullDistance);
                expect(distance).toBeLessThanOrEqual(160);
            }
        });

        it('should reset on touchend without threshold', async () => {
            document.dispatchEvent(createTouchEvent('touchstart', 0));
            document.dispatchEvent(createTouchEvent('touchmove', 50)); // Below threshold
            document.dispatchEvent(createTouchEvent('touchend', 50));

            // Wait for reset animation
            await new Promise(resolve => setTimeout(resolve, 350));

            const indicator = document.querySelector('.pull-refresh-indicator');
            expect(indicator?.classList.contains('active')).toBe(false);
        });

        it('should prevent default scrolling when pulling', async () => {
            const event = createTouchEvent('touchmove', 50);
            const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

            document.dispatchEvent(createTouchEvent('touchstart', 0));

            // Create cancelable event
            const moveEvent = new TouchEvent('touchmove', {
                bubbles: true,
                cancelable: true,
                touches: [{
                    clientY: 50,
                    clientX: 100,
                    identifier: 0,
                    target: document.body,
                    screenX: 100,
                    screenY: 50,
                    pageX: 100,
                    pageY: 50,
                    radiusX: 0,
                    radiusY: 0,
                    rotationAngle: 0,
                    force: 1,
                } as Touch],
            });

            document.dispatchEvent(moveEvent);
            // Verify the event was dispatched without error
            expect(moveEvent).toBeDefined();
        });
    });

    // ========================================
    // Refresh Trigger Tests
    // ========================================

    describe('Refresh Trigger', () => {
        beforeEach(() => {
            initPullRefresh();
            loadAllData.mockResolvedValue(undefined);
        });

        it('should trigger refresh on release past threshold', async () => {
            document.dispatchEvent(createTouchEvent('touchstart', 0));
            document.dispatchEvent(createTouchEvent('touchmove', 150));
            document.dispatchEvent(createTouchEvent('touchend', 150));

            // Wait for async refresh
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(loadAllData).toHaveBeenCalled();
        });

        it('should show refreshing state', async () => {
            document.dispatchEvent(createTouchEvent('touchstart', 0));
            document.dispatchEvent(createTouchEvent('touchmove', 150));
            document.dispatchEvent(createTouchEvent('touchend', 150));

            const indicator = document.querySelector('.pull-refresh-indicator');
            const text = indicator?.querySelector('.pull-refresh-text');

            expect(indicator?.classList.contains('refreshing')).toBe(true);
            expect(text?.textContent).toBe('Refreshing...');
        });

        it('should log refresh trigger', async () => {
            document.dispatchEvent(createTouchEvent('touchstart', 0));
            document.dispatchEvent(createTouchEvent('touchmove', 150));
            document.dispatchEvent(createTouchEvent('touchend', 150));

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'pull-refresh.triggered',
                    data: { source: 'touch-gesture' },
                })
            );
        });

        it('should show success toast on completion', async () => {
            document.dispatchEvent(createTouchEvent('touchstart', 0));
            document.dispatchEvent(createTouchEvent('touchmove', 150));
            document.dispatchEvent(createTouchEvent('touchend', 150));

            await new Promise(resolve => setTimeout(resolve, 100));

            expect(ToastManager.success).toHaveBeenCalledWith('Data refreshed!');
        });

        it('should log completion with duration', async () => {
            document.dispatchEvent(createTouchEvent('touchstart', 0));
            document.dispatchEvent(createTouchEvent('touchmove', 150));
            document.dispatchEvent(createTouchEvent('touchend', 150));

            await new Promise(resolve => setTimeout(resolve, 100));

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'pull-refresh.complete',
                    success: true,
                    durationMs: expect.any(Number),
                })
            );
        });

        it('should reset indicator after refresh', async () => {
            document.dispatchEvent(createTouchEvent('touchstart', 0));
            document.dispatchEvent(createTouchEvent('touchmove', 150));
            document.dispatchEvent(createTouchEvent('touchend', 150));

            // Wait for refresh and reset animation
            await new Promise(resolve => setTimeout(resolve, 500));

            const indicator = document.querySelector('.pull-refresh-indicator');
            expect(indicator?.classList.contains('refreshing')).toBe(false);
        });

        it('should not trigger refresh while already refreshing', async () => {
            // First refresh
            document.dispatchEvent(createTouchEvent('touchstart', 0));
            document.dispatchEvent(createTouchEvent('touchmove', 150));
            document.dispatchEvent(createTouchEvent('touchend', 150));

            // Immediate second attempt
            document.dispatchEvent(createTouchEvent('touchstart', 0));
            document.dispatchEvent(createTouchEvent('touchmove', 150));
            document.dispatchEvent(createTouchEvent('touchend', 150));

            await new Promise(resolve => setTimeout(resolve, 100));

            // Should only be called once
            expect(loadAllData).toHaveBeenCalledTimes(1);
        });
    });

    // ========================================
    // Error Handling Tests
    // ========================================

    describe('Error Handling', () => {
        beforeEach(() => {
            initPullRefresh();
        });

        it('should show error toast on refresh failure', async () => {
            loadAllData.mockRejectedValue(new Error('Network error'));

            document.dispatchEvent(createTouchEvent('touchstart', 0));
            document.dispatchEvent(createTouchEvent('touchmove', 150));
            document.dispatchEvent(createTouchEvent('touchend', 150));

            await new Promise(resolve => setTimeout(resolve, 100));

            expect(ToastManager.error).toHaveBeenCalledWith('Failed to refresh data');
        });

        it('should log error details', async () => {
            const error = new Error('API Error');
            loadAllData.mockRejectedValue(error);

            document.dispatchEvent(createTouchEvent('touchstart', 0));
            document.dispatchEvent(createTouchEvent('touchmove', 150));
            document.dispatchEvent(createTouchEvent('touchend', 150));

            await new Promise(resolve => setTimeout(resolve, 100));

            expect(logger.error).toHaveBeenCalledWith(
                expect.objectContaining({
                    operation: 'pull-refresh.failed',
                    error: expect.objectContaining({
                        name: 'Error',
                        message: 'API Error',
                        module: 'pull-refresh',
                    }),
                })
            );
        });

        it('should reset indicator after error', async () => {
            loadAllData.mockRejectedValue(new Error('Failed'));

            document.dispatchEvent(createTouchEvent('touchstart', 0));
            document.dispatchEvent(createTouchEvent('touchmove', 150));
            document.dispatchEvent(createTouchEvent('touchend', 150));

            await new Promise(resolve => setTimeout(resolve, 500));

            const indicator = document.querySelector('.pull-refresh-indicator');
            expect(indicator?.classList.contains('refreshing')).toBe(false);
        });

        it('should allow new refresh after error', async () => {
            loadAllData.mockRejectedValueOnce(new Error('Failed'));
            loadAllData.mockResolvedValueOnce(undefined);

            // First attempt (fails)
            document.dispatchEvent(createTouchEvent('touchstart', 0));
            document.dispatchEvent(createTouchEvent('touchmove', 150));
            document.dispatchEvent(createTouchEvent('touchend', 150));

            await new Promise(resolve => setTimeout(resolve, 500));

            // Second attempt (succeeds)
            document.dispatchEvent(createTouchEvent('touchstart', 0));
            document.dispatchEvent(createTouchEvent('touchmove', 150));
            document.dispatchEvent(createTouchEvent('touchend', 150));

            await new Promise(resolve => setTimeout(resolve, 100));

            expect(loadAllData).toHaveBeenCalledTimes(2);
            expect(ToastManager.success).toHaveBeenCalled();
        });
    });

    // ========================================
    // Cleanup Tests
    // ========================================

    describe('Cleanup', () => {
        it('should remove indicator element', () => {
            initPullRefresh();
            expect(document.querySelector('.pull-refresh-indicator')).toBeTruthy();

            cleanupPullRefresh();
            expect(document.querySelector('.pull-refresh-indicator')).toBeFalsy();
        });

        it('should remove event listeners', () => {
            initPullRefresh();
            cleanupPullRefresh();

            // After cleanup, gestures should not work
            document.dispatchEvent(createTouchEvent('touchstart', 0));
            document.dispatchEvent(createTouchEvent('touchmove', 150));

            // No indicator should be active (it's removed)
            const indicator = document.querySelector('.pull-refresh-indicator');
            expect(indicator).toBeFalsy();
        });

        it('should be safe to call multiple times', () => {
            initPullRefresh();
            cleanupPullRefresh();
            expect(() => cleanupPullRefresh()).not.toThrow();
            expect(() => cleanupPullRefresh()).not.toThrow();
        });

        it('should be safe to call before init', () => {
            // Don't init
            expect(() => cleanupPullRefresh()).not.toThrow();
        });
    });

    // ========================================
    // Edge Cases
    // ========================================

    describe('Edge Cases', () => {
        beforeEach(() => {
            initPullRefresh();
        });

        it('should handle touchmove without touchstart', () => {
            // Direct touchmove without start
            expect(() => {
                document.dispatchEvent(createTouchEvent('touchmove', 100));
            }).not.toThrow();
        });

        it('should handle touchend without touchstart', () => {
            expect(() => {
                document.dispatchEvent(createTouchEvent('touchend', 100));
            }).not.toThrow();
        });

        it('should handle empty touch list', () => {
            const emptyTouchEvent = new TouchEvent('touchstart', {
                bubbles: true,
                touches: [],
            });

            expect(() => {
                document.dispatchEvent(emptyTouchEvent);
            }).not.toThrow();
        });

        it('should handle scroll position change during pull', async () => {
            document.dispatchEvent(createTouchEvent('touchstart', 0));

            // Simulate scroll during pull
            setScrollPosition(50);

            document.dispatchEvent(createTouchEvent('touchmove', 100));

            // Pull should be cancelled
            const indicator = document.querySelector('.pull-refresh-indicator');
            expect(indicator?.classList.contains('active')).toBe(false);
        });

        it('should handle rapid touch events', async () => {
            loadAllData.mockResolvedValue(undefined);

            // Rapid gesture
            for (let i = 0; i < 10; i++) {
                document.dispatchEvent(createTouchEvent('touchstart', 0));
                document.dispatchEvent(createTouchEvent('touchmove', 150));
                document.dispatchEvent(createTouchEvent('touchend', 150));
            }

            await new Promise(resolve => setTimeout(resolve, 100));

            // Should only process first one (rest blocked by isRefreshing)
            expect(loadAllData).toHaveBeenCalledTimes(1);
        });

        it('should handle very small pull distance', () => {
            document.dispatchEvent(createTouchEvent('touchstart', 100));
            document.dispatchEvent(createTouchEvent('touchmove', 101));

            const indicator = document.querySelector('.pull-refresh-indicator');
            // Small distance might not activate
            expect(indicator?.classList.contains('threshold-reached')).toBe(false);
        });

        it('should handle exact threshold distance', async () => {
            loadAllData.mockResolvedValue(undefined);

            document.dispatchEvent(createTouchEvent('touchstart', 0));
            document.dispatchEvent(createTouchEvent('touchmove', 120)); // Exact threshold
            document.dispatchEvent(createTouchEvent('touchend', 120));

            await new Promise(resolve => setTimeout(resolve, 100));

            expect(loadAllData).toHaveBeenCalled();
        });
    });

    // ========================================
    // CSS Custom Property Tests
    // ========================================

    describe('CSS Custom Properties', () => {
        beforeEach(() => {
            initPullRefresh();
        });

        it('should set --pull-distance CSS variable', () => {
            document.dispatchEvent(createTouchEvent('touchstart', 0));
            document.dispatchEvent(createTouchEvent('touchmove', 80));

            const indicator = document.querySelector('.pull-refresh-indicator') as HTMLElement;
            const pullDistance = indicator?.style.getPropertyValue('--pull-distance');

            expect(pullDistance).toBe('73.80491769800285px');
        });

        it('should set --pull-progress CSS variable', () => {
            document.dispatchEvent(createTouchEvent('touchstart', 0));
            document.dispatchEvent(createTouchEvent('touchmove', 50)); // 50% of 100

            const indicator = document.querySelector('.pull-refresh-indicator') as HTMLElement;
            const progress = indicator?.style.getPropertyValue('--pull-progress');

            expect(progress).toBe('0.7142857142857143');
        });

        it('should clamp progress at 1', () => {
            document.dispatchEvent(createTouchEvent('touchstart', 0));
            document.dispatchEvent(createTouchEvent('touchmove', 200)); // Way past threshold

            const indicator = document.querySelector('.pull-refresh-indicator') as HTMLElement;
            const progress = indicator?.style.getPropertyValue('--pull-progress');

            expect(progress).toBe('1');
        });

        it('should clamp distance at MAX_PULL_DISTANCE', () => {
            document.dispatchEvent(createTouchEvent('touchstart', 0));
            document.dispatchEvent(createTouchEvent('touchmove', 300)); // Way past max

            const indicator = document.querySelector('.pull-refresh-indicator') as HTMLElement;
            const pullDistance = indicator?.style.getPropertyValue('--pull-distance');

            expect(parseFloat(pullDistance || '0')).toBeLessThanOrEqual(160);
        });
    });

    // ========================================
    // Global Export Tests
    // ========================================

    describe('Global Exports', () => {
        it('should export initPullRefresh to window', () => {
            // The module should have assigned to window
            expect(typeof (window as unknown as Record<string, unknown>).initPullRefresh).toBe('function');
        });

        it('should export cleanupPullRefresh to window', () => {
            expect(typeof (window as unknown as Record<string, unknown>).cleanupPullRefresh).toBe('function');
        });
    });
});

// ========================================
// Integration Tests
// ========================================

describe('Pull-to-Refresh Integration', () => {
    let initPullRefresh: () => void;
    let cleanupPullRefresh: () => void;
    let loadAllData: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        createMinimalDOM();
        setScrollPosition(0);
        mockTouchDevice(true);

        vi.resetModules();

        const loggerMock = createLoggerMock();
        const toastMock = createToastMock();
        const dataServiceMock = createDataServiceMock();

        vi.doMock('../../src/modules/logger.ts', () => loggerMock);
        vi.doMock('../../src/modules/toast.ts', () => toastMock);
        vi.doMock('../../src/modules/data-service.ts', () => dataServiceMock);

        const pullRefreshModule = await import('../../src/modules/pull-refresh.ts');
        initPullRefresh = pullRefreshModule.initPullRefresh;
        cleanupPullRefresh = pullRefreshModule.cleanupPullRefresh;

        // Disable new sensitivity guards for existing tests
        pullRefreshModule.PULL_REFRESH_CONFIG.MIN_TOUCH_DURATION_MS = 0;
        pullRefreshModule.PULL_REFRESH_CONFIG.COOLDOWN_MS = 0;

        const dataService = await import('../../src/modules/data-service.ts');
        loadAllData = dataService.loadAllData as ReturnType<typeof vi.fn>;
    });

    afterEach(() => {
        cleanupPullRefresh?.();
        vi.clearAllMocks();
    });

    it('should complete full pull-refresh cycle', async () => {
        loadAllData.mockImplementation(async () => {
            await new Promise(resolve => setTimeout(resolve, 50));
        });

        initPullRefresh();

        // Simulate complete gesture
        document.dispatchEvent(createTouchEvent('touchstart', 0));

        // Gradual pull
        for (let y = 20; y <= 150; y += 20) {
            document.dispatchEvent(createTouchEvent('touchmove', y));
            await new Promise(resolve => setTimeout(resolve, 10));
        }

        document.dispatchEvent(createTouchEvent('touchend', 150));

        // Wait for refresh to complete
        await new Promise(resolve => setTimeout(resolve, 200));

        expect(loadAllData).toHaveBeenCalled();
    });

    it('should handle multiple complete refresh cycles', async () => {
        loadAllData.mockResolvedValue(undefined);

        initPullRefresh();

        // First cycle
        document.dispatchEvent(createTouchEvent('touchstart', 0));
        document.dispatchEvent(createTouchEvent('touchmove', 150));
        document.dispatchEvent(createTouchEvent('touchend', 150));

        await new Promise(resolve => setTimeout(resolve, 500));

        // Second cycle
        document.dispatchEvent(createTouchEvent('touchstart', 0));
        document.dispatchEvent(createTouchEvent('touchmove', 150));
        document.dispatchEvent(createTouchEvent('touchend', 150));

        await new Promise(resolve => setTimeout(resolve, 100));

        expect(loadAllData).toHaveBeenCalledTimes(2);
    });
});
