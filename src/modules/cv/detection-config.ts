// ========================================
// CV Detection Configuration
// ========================================

import { getThresholdForRarity } from './scoring-config.ts';
import { getResolutionTier } from './resolution-profiles.ts';

// ========================================
// Worker Path Configuration
// ========================================

/** Base path for worker scripts - can be overridden for subdirectory deployments */
let workerBasePath = '';

/**
 * Set the base path for worker scripts
 * Useful for deployments where the app is not at the root URL
 * @param path The base path (e.g., '/megabonk' or '' for root)
 */
export function setWorkerBasePath(path: string): void {
    // Normalize: remove trailing slash if present
    workerBasePath = path.endsWith('/') ? path.slice(0, -1) : path;
}

/**
 * Get the full path to a worker script
 */
export function getWorkerPath(workerName: string): string {
    return `${workerBasePath}/workers/${workerName}`;
}

// ========================================
// Detection Lock (Race Condition Prevention)
// ========================================

/**
 * Race condition fix: Lock to prevent concurrent CV detection runs
 * Without this, multiple detectItemsWithCV calls could corrupt shared state:
 * - Metrics collector accumulates overlapping data
 * - Cache operations could conflict
 * - Progress callbacks would interleave confusingly
 */
let cvDetectionInProgress = false;

export function isCVDetectionInProgress(): boolean {
    return cvDetectionInProgress;
}

export function setCVDetectionInProgress(value: boolean): void {
    cvDetectionInProgress = value;
}

// ========================================
// Image Loading Configuration
// ========================================

/** Default timeout for image loading (30 seconds) */
export const IMAGE_LOAD_TIMEOUT_MS = 30000;

// ========================================
// Dynamic Confidence Thresholds
// ========================================

/**
 * Get dynamic minimum confidence threshold based on resolution and scoring config
 * Uses scoring-config.ts for rarity-aware thresholds
 */
export function getDynamicMinConfidence(width?: number, height?: number, rarity?: string): number {
    // Get base threshold from scoring config (rarity-aware)
    const baseThreshold = getThresholdForRarity(rarity);

    // Adjust based on resolution tier if dimensions provided
    if (width && height) {
        const tier = getResolutionTier(width, height);
        // Lower threshold for low-res (harder to match), higher for high-res
        const tierAdjustment = {
            low: -0.05, // 720p: more lenient
            medium: 0, // 1080p: baseline
            high: 0.02, // 1440p: slightly stricter
            ultra: 0.03, // 4K: stricter (clearer images)
        };
        return Math.max(0.35, Math.min(0.75, baseThreshold + tierAdjustment[tier]));
    }

    return baseThreshold;
}
