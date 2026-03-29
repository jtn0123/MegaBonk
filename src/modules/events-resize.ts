// ========================================
// Resize & Scroll Event Handlers
// Extracted from events-core.ts for modularity
// ========================================

import { debounce } from './utils.ts';

// Type for listener options factory function to avoid circular imports
type ListenerOptionsFactory = (options?: { passive?: boolean }) => AddEventListenerOptions | undefined;

// Track scroll/resize listener cleanup functions to prevent memory leaks
let scrollListenerCleanup: (() => void) | null = null;
let resizeListenerCleanup: (() => void) | null = null;
let stickySearchCleanup: (() => void) | null = null;

/**
 * Check if we're on mobile (≤480px)
 */
export function isMobileViewport(): boolean {
    return window.matchMedia('(max-width: 480px)').matches;
}

/**
 * Clean up tab scroll/resize listeners
 * Prevents memory leaks from accumulated listeners
 */
export function cleanupTabScrollListeners(): void {
    if (scrollListenerCleanup) {
        scrollListenerCleanup();
        scrollListenerCleanup = null;
    }
    if (resizeListenerCleanup) {
        resizeListenerCleanup();
        resizeListenerCleanup = null;
    }
    if (stickySearchCleanup) {
        stickySearchCleanup();
        stickySearchCleanup = null;
    }
}

/**
 * Setup tab scroll indicators for mobile
 */
export function setupTabScrollIndicators(getListenerOptions: ListenerOptionsFactory): void {
    const tabContainer = document.querySelector<HTMLElement>('.tabs .container');
    const tabButtons = document.querySelector<HTMLElement>('.tab-buttons');

    if (!tabContainer || !tabButtons) return;

    cleanupTabScrollListeners();

    const updateTabScrollIndicators = (): void => {
        const canScrollLeft = tabButtons.scrollLeft > 5;
        const canScrollRight = tabButtons.scrollLeft < tabButtons.scrollWidth - tabButtons.clientWidth - 5;
        tabContainer.classList.toggle('can-scroll-left', canScrollLeft);
        tabContainer.classList.toggle('can-scroll-right', canScrollRight);
    };

    let scrollRAFPending = false;
    const throttledScrollHandler = (): void => {
        if (scrollRAFPending) return;
        scrollRAFPending = true;
        requestAnimationFrame(() => {
            updateTabScrollIndicators();
            scrollRAFPending = false;
        });
    };

    const debouncedResizeHandler = debounce(updateTabScrollIndicators, 100);

    tabButtons.addEventListener('scroll', throttledScrollHandler, getListenerOptions({ passive: true }));
    window.addEventListener('resize', debouncedResizeHandler, getListenerOptions());

    scrollListenerCleanup = () => tabButtons.removeEventListener('scroll', throttledScrollHandler);
    resizeListenerCleanup = () => window.removeEventListener('resize', debouncedResizeHandler);

    setTimeout(updateTabScrollIndicators, 100);
}

/**
 * Setup sticky search bar that hides on scroll down, shows on scroll up
 */
export function setupStickySearchHideOnScroll(getListenerOptions: ListenerOptionsFactory): void {
    const controls = document.querySelector<HTMLElement>('.controls');
    if (!controls) return;

    // Only enable on mobile
    const isMobile = window.matchMedia('(max-width: 768px)');
    if (!isMobile.matches) return;

    let lastScrollY = window.scrollY;
    let ticking = false;
    const scrollThreshold = 10;

    const handleScroll = (): void => {
        if (ticking) return;

        ticking = true;
        requestAnimationFrame(() => {
            const currentScrollY = window.scrollY;
            const scrollDelta = currentScrollY - lastScrollY;

            if (currentScrollY <= 0) {
                controls.classList.remove('controls-hidden');
            } else if (scrollDelta > scrollThreshold) {
                controls.classList.add('controls-hidden');
            } else if (scrollDelta < -scrollThreshold) {
                controls.classList.remove('controls-hidden');
            }

            lastScrollY = currentScrollY;
            ticking = false;
        });
    };

    window.addEventListener('scroll', handleScroll, getListenerOptions({ passive: true }));

    const mediaChangeHandler = (e: MediaQueryListEvent): void => {
        if (!e.matches) {
            controls.classList.remove('controls-hidden');
        }
    };
    isMobile.addEventListener('change', mediaChangeHandler);

    stickySearchCleanup = () => {
        window.removeEventListener('scroll', handleScroll);
        isMobile.removeEventListener('change', mediaChangeHandler);
    };
}
