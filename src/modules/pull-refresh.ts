// ========================================
// MegaBonk Pull-to-Refresh Module
// ========================================
// Enables pull-down gesture to refresh data on touch devices

import { loadAllData } from './data-service.ts';
import { logger } from './logger.ts';
import { ToastManager } from './toast.ts';

// ========================================
// Constants
// ========================================

/** Pull-to-refresh configuration (exported for testing) */
export const PULL_REFRESH_CONFIG = {
    PULL_THRESHOLD: 100, // Pixels to pull before refresh triggers
    MAX_PULL_DISTANCE: 160, // Maximum visual pull distance
    RESISTANCE_FACTOR: 0.4, // Resistance when pulling past threshold (higher = more dampening)
    MIN_TOUCH_DURATION_MS: 180, // Minimum touch duration to prevent quick flick triggers
    COOLDOWN_MS: 2000, // Cooldown period after a refresh before allowing another
};

// ========================================
// State
// ========================================

interface PullRefreshState {
    startY: number;
    currentY: number;
    startTime: number;
    isPulling: boolean;
    isRefreshing: boolean;
    lastRefreshTime: number;
    indicator: HTMLElement | null;
}

const state: PullRefreshState = {
    startY: 0,
    currentY: 0,
    startTime: 0,
    isPulling: false,
    isRefreshing: false,
    lastRefreshTime: 0,
    indicator: null,
};

// ========================================
// Detection
// ========================================

/**
 * Check if we're on a touch device
 */
function isTouchDevice(): boolean {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/**
 * Check if page is scrolled to the top
 */
function isAtTop(): boolean {
    return window.scrollY === 0;
}

/**
 * Check if cooldown period has elapsed since last refresh
 */
function isCooldownElapsed(): boolean {
    return Date.now() - state.lastRefreshTime >= PULL_REFRESH_CONFIG.COOLDOWN_MS;
}

// ========================================
// UI
// ========================================

/**
 * Create the pull-to-refresh indicator element
 */
function createIndicator(): HTMLElement {
    const indicator = document.createElement('div');
    indicator.className = 'pull-refresh-indicator';
    indicator.innerHTML = `
        <div class="pull-refresh-content">
            <div class="pull-refresh-spinner"></div>
            <span class="pull-refresh-text">Pull to refresh</span>
        </div>
    `;
    document.body.prepend(indicator);
    return indicator;
}

/**
 * Update the indicator position and state
 */
function updateIndicator(distance: number, isRefreshing: boolean = false): void {
    if (!state.indicator) return;

    const progress = Math.min(distance / PULL_REFRESH_CONFIG.PULL_THRESHOLD, 1);
    const clampedDistance = Math.min(distance, PULL_REFRESH_CONFIG.MAX_PULL_DISTANCE);

    state.indicator.style.setProperty('--pull-distance', `${clampedDistance}px`);
    state.indicator.style.setProperty('--pull-progress', `${progress}`);

    const textEl = state.indicator.querySelector('.pull-refresh-text');
    if (textEl) {
        if (isRefreshing) {
            textEl.textContent = 'Refreshing...';
        } else if (distance >= PULL_REFRESH_CONFIG.PULL_THRESHOLD) {
            textEl.textContent = 'Release to refresh';
        } else {
            textEl.textContent = 'Pull to refresh';
        }
    }

    state.indicator.classList.toggle('active', distance > 0);
    state.indicator.classList.toggle('threshold-reached', distance >= PULL_REFRESH_CONFIG.PULL_THRESHOLD);
    state.indicator.classList.toggle('refreshing', isRefreshing);
}

/**
 * Reset the indicator to hidden state
 */
function resetIndicator(): void {
    if (!state.indicator) return;

    state.indicator.classList.add('resetting');
    updateIndicator(0, false);

    setTimeout(() => {
        state.indicator?.classList.remove('active', 'threshold-reached', 'refreshing', 'resetting');
    }, 300);
}

// ========================================
// Touch Handlers
// ========================================

function handleTouchStart(e: TouchEvent): void {
    // Only enable when at top of page, not refreshing, and cooldown elapsed
    if (!isAtTop() || state.isRefreshing || !isCooldownElapsed()) return;

    const touch = e.touches[0];
    if (!touch) return;

    state.startY = touch.clientY;
    state.startTime = Date.now();
    state.isPulling = true;
}

function handleTouchMove(e: TouchEvent): void {
    if (!state.isPulling || state.isRefreshing) return;
    if (!isAtTop()) {
        state.isPulling = false;
        return;
    }

    const touch = e.touches[0];
    if (!touch) return;

    state.currentY = touch.clientY;
    let distance = state.currentY - state.startY;

    // Only allow pulling down
    if (distance < 0) {
        state.isPulling = false;
        return;
    }

    // Apply resistance after threshold
    if (distance > PULL_REFRESH_CONFIG.PULL_THRESHOLD) {
        const overPull = distance - PULL_REFRESH_CONFIG.PULL_THRESHOLD;
        distance = PULL_REFRESH_CONFIG.PULL_THRESHOLD + overPull * PULL_REFRESH_CONFIG.RESISTANCE_FACTOR;
    }

    // Prevent default scrolling when pulling
    if (distance > 10) {
        e.preventDefault();
    }

    updateIndicator(distance);
}

async function handleTouchEnd(): Promise<void> {
    if (!state.isPulling) return;
    state.isPulling = false;

    const distance = state.currentY - state.startY;

    const touchDuration = Date.now() - state.startTime;

    if (distance >= PULL_REFRESH_CONFIG.PULL_THRESHOLD && !state.isRefreshing && touchDuration >= PULL_REFRESH_CONFIG.MIN_TOUCH_DURATION_MS) {
        await triggerRefresh();
    } else {
        resetIndicator();
    }

    state.startY = 0;
    state.currentY = 0;
    state.startTime = 0;
}

// ========================================
// Refresh Logic
// ========================================

/**
 * Trigger a data refresh
 */
async function triggerRefresh(): Promise<void> {
    state.isRefreshing = true;
    updateIndicator(PULL_REFRESH_CONFIG.PULL_THRESHOLD, true);

    logger.info({
        operation: 'pull-refresh.triggered',
        data: { source: 'touch-gesture' },
    });

    const startTime = performance.now();

    try {
        await loadAllData();

        const duration = Math.round(performance.now() - startTime);
        logger.info({
            operation: 'pull-refresh.complete',
            durationMs: duration,
            success: true,
        });

        ToastManager.success('Data refreshed!');
    } catch (error) {
        const err = error as Error;
        logger.error({
            operation: 'pull-refresh.failed',
            error: {
                name: err.name,
                message: err.message,
                module: 'pull-refresh',
            },
        });
        ToastManager.error('Failed to refresh data');
    } finally {
        state.isRefreshing = false;
        state.lastRefreshTime = Date.now();
        resetIndicator();
    }
}

// ========================================
// Initialization
// ========================================

/**
 * Initialize pull-to-refresh functionality
 * Only activates on touch devices
 */
export function initPullRefresh(): void {
    // Only enable on touch devices
    if (!isTouchDevice()) {
        logger.debug({
            operation: 'pull-refresh.skip',
            data: { reason: 'not_touch_device' },
        });
        return;
    }

    // Create the indicator element
    state.indicator = createIndicator();

    // Add touch event listeners with passive: false for preventDefault
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    logger.info({
        operation: 'pull-refresh.init',
        data: { enabled: true },
    });
}

/**
 * Clean up pull-to-refresh (for testing)
 */
export function cleanupPullRefresh(): void {
    document.removeEventListener('touchstart', handleTouchStart);
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleTouchEnd);

    if (state.indicator) {
        state.indicator.remove();
        state.indicator = null;
    }

    state.isPulling = false;
    state.isRefreshing = false;
}

// ========================================
// Global Exports
// ========================================

if (typeof window !== 'undefined') {
    Object.assign(window, {
        initPullRefresh,
        cleanupPullRefresh,
    });
}
