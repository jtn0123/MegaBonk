/**
 * Events Resize Module Tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../src/modules/utils.ts', () => ({
    safeGetElementById: vi.fn((id: string) => document.getElementById(id)),
    debounce: vi.fn((fn: Function) => fn),
}));

import {
    isMobileViewport,
    cleanupTabScrollListeners,
    setupStickySearchHideOnScroll,
    setupTabScrollIndicators,
} from '../../src/modules/events-resize.ts';

describe('events-resize', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    describe('isMobileViewport', () => {
        it('should call matchMedia with correct query', () => {
            // Setup.js provides matchMedia mock, returns matches: false by default
            const result = isMobileViewport();
            expect(typeof result).toBe('boolean');
            expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 480px)');
        });

        it('should return true when matchMedia matches', () => {
            vi.mocked(window.matchMedia).mockReturnValue({
                matches: true,
                media: '(max-width: 480px)',
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                addListener: vi.fn(),
                removeListener: vi.fn(),
                onchange: null,
                dispatchEvent: vi.fn(),
            } as any);
            expect(isMobileViewport()).toBe(true);
        });

        it('should return false when matchMedia does not match', () => {
            vi.mocked(window.matchMedia).mockReturnValue({
                matches: false,
                media: '(max-width: 480px)',
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                addListener: vi.fn(),
                removeListener: vi.fn(),
                onchange: null,
                dispatchEvent: vi.fn(),
            } as any);
            expect(isMobileViewport()).toBe(false);
        });
    });

    describe('cleanupTabScrollListeners', () => {
        it('should not throw when called with no active listeners', () => {
            expect(() => cleanupTabScrollListeners()).not.toThrow();
        });

        it('should be callable multiple times safely', () => {
            cleanupTabScrollListeners();
            cleanupTabScrollListeners();
            expect(() => cleanupTabScrollListeners()).not.toThrow();
        });
    });

    describe('setupStickySearchHideOnScroll', () => {
        it('should do nothing without .controls element', () => {
            const addSpy = vi.spyOn(window, 'addEventListener');
            const getListenerOptions = vi.fn(() => undefined);
            setupStickySearchHideOnScroll(getListenerOptions);
            const scrollCalls = addSpy.mock.calls.filter(c => c[0] === 'scroll');
            expect(scrollCalls.length).toBe(0);
            addSpy.mockRestore();
        });

        it('should do nothing on desktop viewport', () => {
            document.body.innerHTML = '<div class="controls"></div>';
            // Setup.js matchMedia returns matches: false by default (desktop)
            const getListenerOptions = vi.fn(() => undefined);
            const addSpy = vi.spyOn(window, 'addEventListener');
            setupStickySearchHideOnScroll(getListenerOptions);
            const scrollCalls = addSpy.mock.calls.filter(c => c[0] === 'scroll');
            expect(scrollCalls.length).toBe(0);
            addSpy.mockRestore();
        });

        it('should set up scroll listener on mobile', () => {
            document.body.innerHTML = '<div class="controls"></div>';
            vi.mocked(window.matchMedia).mockReturnValue({
                matches: true,
                media: '(max-width: 768px)',
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                addListener: vi.fn(),
                removeListener: vi.fn(),
                onchange: null,
                dispatchEvent: vi.fn(),
            } as any);
            const addSpy = vi.spyOn(window, 'addEventListener');
            const getListenerOptions = vi.fn(() => undefined);
            setupStickySearchHideOnScroll(getListenerOptions);
            const scrollCalls = addSpy.mock.calls.filter(c => c[0] === 'scroll');
            expect(scrollCalls.length).toBe(1);
            addSpy.mockRestore();
        });
    });

    describe('setupTabScrollIndicators', () => {
        it('should do nothing without tab container', () => {
            const getListenerOptions = vi.fn(() => undefined);
            expect(() => setupTabScrollIndicators(getListenerOptions)).not.toThrow();
        });

        it('should set up listeners with tab container', () => {
            document.body.innerHTML = `
                <div class="tabs"><div class="container">
                    <div class="tab-buttons" style="overflow-x: scroll;">
                        <button>Tab 1</button><button>Tab 2</button>
                    </div>
                </div></div>
            `;
            const getListenerOptions = vi.fn(() => undefined);
            const addSpy = vi.spyOn(window, 'addEventListener');
            setupTabScrollIndicators(getListenerOptions);
            // Should add resize listener
            const resizeCalls = addSpy.mock.calls.filter(c => c[0] === 'resize');
            expect(resizeCalls.length).toBe(1);
            addSpy.mockRestore();
        });

        it('should clean up previous listeners when called again', () => {
            document.body.innerHTML = `
                <div class="tabs"><div class="container">
                    <div class="tab-buttons"><button>Tab 1</button></div>
                </div></div>
            `;
            const getListenerOptions = vi.fn(() => undefined);
            // Call twice to exercise cleanup
            setupTabScrollIndicators(getListenerOptions);
            setupTabScrollIndicators(getListenerOptions);
            // Verify no error and setup completes
            expect(() => setupTabScrollIndicators(getListenerOptions)).not.toThrow();
        });
    });
});
