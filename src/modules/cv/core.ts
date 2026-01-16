// ========================================
// CV Core - Initialization and Cleanup
// ========================================

import type { AllGameData } from '../../types/index.ts';
import { logger } from '../logger.ts';
import {
    getItemTemplates,
    getTemplatesByColor,
    getDetectionCache,
    getCacheCleanupTimer,
    setAllData,
    setTemplatesLoaded,
    setPriorityTemplatesLoaded,
    setCacheCleanupTimer,
    isTemplatesLoaded,
    isPriorityTemplatesLoaded as isPriorityTemplatesLoadedState,
    CACHE_TTL,
    MAX_CACHE_SIZE,
} from './state.ts';

// ========================================
// Cache Cleanup
// ========================================

/**
 * Start periodic cache cleanup to prevent memory leaks
 * Runs every 5 minutes to evict expired entries
 */
export function startCacheCleanup(): void {
    if (getCacheCleanupTimer()) return; // Already running

    const timer = setInterval(
        () => {
            const now = Date.now();
            let evicted = 0;
            const detectionCache = getDetectionCache();

            // Evict expired cache entries
            for (const [key, entry] of detectionCache.entries()) {
                if (now - entry.timestamp > CACHE_TTL) {
                    detectionCache.delete(key);
                    evicted++;
                }
            }

            // If still over max size, evict oldest entries
            if (detectionCache.size > MAX_CACHE_SIZE) {
                const entries = Array.from(detectionCache.entries());
                entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

                const toEvict = detectionCache.size - MAX_CACHE_SIZE + 10; // Evict 10 extra
                for (let i = 0; i < toEvict && i < entries.length; i++) {
                    const entry = entries[i];
                    if (entry) {
                        detectionCache.delete(entry[0]);
                        evicted++;
                    }
                }
            }

            if (evicted > 0) {
                logger.info({
                    operation: 'cv.cache_cleanup',
                    data: { evicted, remaining: detectionCache.size },
                });
            }
        },
        5 * 60 * 1000
    ); // Run every 5 minutes

    setCacheCleanupTimer(timer);
}

/**
 * Stop periodic cache cleanup
 */
export function stopCacheCleanup(): void {
    const timer = getCacheCleanupTimer();
    if (timer) {
        clearInterval(timer);
        setCacheCleanupTimer(null);
    }
}

// ========================================
// Initialization and Cleanup
// ========================================

/**
 * Cleanup all CV module resources (templates, caches, timers)
 * Call this when the app is being unloaded or CV is no longer needed
 */
export function cleanupCV(): void {
    // Stop periodic cleanup
    stopCacheCleanup();

    // Clear all caches
    getDetectionCache().clear();
    getItemTemplates().clear();
    getTemplatesByColor().clear();

    // Reset state
    setTemplatesLoaded(false);
    setPriorityTemplatesLoaded(false);
    setAllData({});

    logger.info({
        operation: 'cv.cleanup',
        data: { message: 'CV module cleaned up' },
    });
}

/**
 * Initialize computer vision module
 */
export function initCV(gameData: AllGameData): void {
    // Bug fix #4: Handle null/undefined gameData
    setAllData(gameData || {});

    // Start periodic cache cleanup to prevent memory leaks
    startCacheCleanup();

    logger.info({
        operation: 'cv.init',
        data: {
            itemsCount: gameData?.items?.items?.length || 0,
        },
    });
}

/**
 * Check if all templates are fully loaded (not just priority)
 * Use this to prevent detection with incomplete template set
 */
export function isFullyLoaded(): boolean {
    return isTemplatesLoaded();
}

/**
 * Check if priority templates are loaded (enough for basic detection)
 */
export function isPriorityLoaded(): boolean {
    return isPriorityTemplatesLoadedState();
}
