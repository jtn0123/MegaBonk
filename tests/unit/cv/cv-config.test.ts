/**
 * Unit tests for cv/cv-config.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    getCVConfig,
    getDetectionConfig,
    getCacheConfig,
    getPerformanceConfig,
    getImageValidationConfig,
    updateCVConfig,
    resetCVConfig,
    enableDebugMode,
    disableDebugMode,
    isDebugModeEnabled,
} from '../../../src/modules/cv/cv-config';

describe('cv-config', () => {
    beforeEach(() => {
        resetCVConfig();
    });

    describe('getCVConfig', () => {
        it('should return default configuration', () => {
            const config = getCVConfig();
            expect(config).toBeDefined();
            expect(config.detection).toBeDefined();
            expect(config.cache).toBeDefined();
            expect(config.performance).toBeDefined();
            expect(config.imageValidation).toBeDefined();
        });

        it('should return default minConfidence of 0.5', () => {
            const config = getCVConfig();
            expect(config.detection.minConfidence).toBe(0.5);
        });
    });

    describe('getDetectionConfig', () => {
        it('should return detection defaults', () => {
            const config = getDetectionConfig();
            expect(config.minConfidence).toBe(0.5);
            expect(config.highConfidenceThreshold).toBe(0.8);
            expect(config.maxDetections).toBe(50);
            expect(config.debugMode).toBe(false);
        });
    });

    describe('getCacheConfig', () => {
        it('should return cache defaults', () => {
            const config = getCacheConfig();
            expect(config.detectionCacheTTL).toBe(1000 * 60 * 15);
            expect(config.maxDetectionCacheEntries).toBe(50);
            expect(config.maxResizedCacheEntries).toBe(500);
            expect(config.maxMultiScaleItems).toBe(100);
            expect(config.cleanupInterval).toBe(1000 * 60 * 10);
        });
    });

    describe('getPerformanceConfig', () => {
        it('should return performance defaults', () => {
            const config = getPerformanceConfig();
            expect(config.useWorkers).toBe(false);
            expect(config.maxConcurrentComparisons).toBe(10);
            expect(config.pixelSamplingRate).toBe(4);
            expect(config.enableEarlyExit).toBe(true);
            expect(config.earlyExitThreshold).toBe(0.9);
        });
    });

    describe('getImageValidationConfig', () => {
        it('should return image validation defaults', () => {
            const config = getImageValidationConfig();
            expect(config.minWidth).toBe(320);
            expect(config.minHeight).toBe(240);
            expect(config.maxWidth).toBe(4096);
            expect(config.maxHeight).toBe(2160);
            expect(config.minAspectRatio).toBe(1);
            expect(config.maxAspectRatio).toBe(2.5);
            expect(config.uniformImageVarianceThreshold).toBe(100);
        });
    });

    describe('updateCVConfig', () => {
        it('should update detection config partially', () => {
            updateCVConfig({ detection: { minConfidence: 0.7 } });
            const config = getDetectionConfig();
            expect(config.minConfidence).toBe(0.7);
            // Other fields should remain unchanged
            expect(config.maxDetections).toBe(50);
        });

        it('should update cache config partially', () => {
            updateCVConfig({ cache: { maxDetectionCacheEntries: 100 } });
            const config = getCacheConfig();
            expect(config.maxDetectionCacheEntries).toBe(100);
            expect(config.detectionCacheTTL).toBe(1000 * 60 * 15);
        });

        it('should update performance config partially', () => {
            updateCVConfig({ performance: { useWorkers: true } });
            const config = getPerformanceConfig();
            expect(config.useWorkers).toBe(true);
            expect(config.pixelSamplingRate).toBe(4);
        });

        it('should update imageValidation config partially', () => {
            updateCVConfig({ imageValidation: { minWidth: 640 } });
            const config = getImageValidationConfig();
            expect(config.minWidth).toBe(640);
            expect(config.maxWidth).toBe(4096);
        });

        it('should handle multiple section updates at once', () => {
            updateCVConfig({
                detection: { debugMode: true },
                cache: { maxDetectionCacheEntries: 200 },
                performance: { enableEarlyExit: false },
            });
            expect(getDetectionConfig().debugMode).toBe(true);
            expect(getCacheConfig().maxDetectionCacheEntries).toBe(200);
            expect(getPerformanceConfig().enableEarlyExit).toBe(false);
        });

        it('should not modify unspecified sections', () => {
            const beforePerf = { ...getPerformanceConfig() };
            updateCVConfig({ detection: { minConfidence: 0.9 } });
            const afterPerf = getPerformanceConfig();
            expect(afterPerf.useWorkers).toBe(beforePerf.useWorkers);
            expect(afterPerf.pixelSamplingRate).toBe(beforePerf.pixelSamplingRate);
        });
    });

    describe('resetCVConfig', () => {
        it('should restore all defaults', () => {
            updateCVConfig({
                detection: { minConfidence: 0.99, debugMode: true },
                cache: { maxDetectionCacheEntries: 999 },
            });

            resetCVConfig();

            expect(getDetectionConfig().minConfidence).toBe(0.5);
            expect(getDetectionConfig().debugMode).toBe(false);
            expect(getCacheConfig().maxDetectionCacheEntries).toBe(50);
        });
    });

    describe('debug mode helpers', () => {
        it('should enable debug mode', () => {
            expect(isDebugModeEnabled()).toBe(false);
            enableDebugMode();
            expect(isDebugModeEnabled()).toBe(true);
        });

        it('should disable debug mode', () => {
            enableDebugMode();
            expect(isDebugModeEnabled()).toBe(true);
            disableDebugMode();
            expect(isDebugModeEnabled()).toBe(false);
        });

        it('should toggle independently of other detection config', () => {
            updateCVConfig({ detection: { minConfidence: 0.7 } });
            enableDebugMode();
            expect(getDetectionConfig().minConfidence).toBe(0.7);
            expect(isDebugModeEnabled()).toBe(true);
        });
    });
});
