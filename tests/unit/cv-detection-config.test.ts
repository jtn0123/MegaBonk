// ========================================
// CV Detection Configuration Module - Unit Tests
// ========================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    setWorkerBasePath,
    getWorkerPath,
    isCVDetectionInProgress,
    setCVDetectionInProgress,
    getDynamicMinConfidence,
    IMAGE_LOAD_TIMEOUT_MS,
} from '../../src/modules/cv/detection-config.ts';
import { setScoringConfig, DEFAULT_SCORING_CONFIG } from '../../src/modules/cv/scoring-config.ts';

describe('Worker Path Configuration', () => {
    beforeEach(() => {
        // Reset worker path
        setWorkerBasePath('');
    });

    describe('setWorkerBasePath', () => {
        it('should set empty path for root deployment', () => {
            setWorkerBasePath('');
            expect(getWorkerPath('match-worker.js')).toBe('/workers/match-worker.js');
        });

        it('should set subdirectory path', () => {
            setWorkerBasePath('/megabonk');
            expect(getWorkerPath('match-worker.js')).toBe('/megabonk/workers/match-worker.js');
        });

        it('should strip trailing slash', () => {
            setWorkerBasePath('/app/');
            expect(getWorkerPath('test.js')).toBe('/app/workers/test.js');
        });

        it('should handle nested paths', () => {
            setWorkerBasePath('/path/to/app');
            expect(getWorkerPath('worker.js')).toBe('/path/to/app/workers/worker.js');
        });
    });

    describe('getWorkerPath', () => {
        it('should construct correct path with base', () => {
            setWorkerBasePath('/base');
            expect(getWorkerPath('my-worker.js')).toBe('/base/workers/my-worker.js');
        });

        it('should work with various worker names', () => {
            setWorkerBasePath('');
            expect(getWorkerPath('template-match.js')).toBe('/workers/template-match.js');
            expect(getWorkerPath('histogram-worker.js')).toBe('/workers/histogram-worker.js');
            expect(getWorkerPath('edge-detection.wasm.js')).toBe('/workers/edge-detection.wasm.js');
        });
    });
});

describe('CV Detection Lock', () => {
    afterEach(() => {
        // Reset lock state
        setCVDetectionInProgress(false);
    });

    describe('isCVDetectionInProgress / setCVDetectionInProgress', () => {
        it('should be false initially', () => {
            setCVDetectionInProgress(false);
            expect(isCVDetectionInProgress()).toBe(false);
        });

        it('should set to true', () => {
            setCVDetectionInProgress(true);
            expect(isCVDetectionInProgress()).toBe(true);
        });

        it('should toggle correctly', () => {
            setCVDetectionInProgress(false);
            expect(isCVDetectionInProgress()).toBe(false);

            setCVDetectionInProgress(true);
            expect(isCVDetectionInProgress()).toBe(true);

            setCVDetectionInProgress(false);
            expect(isCVDetectionInProgress()).toBe(false);
        });
    });

    describe('Race Condition Prevention', () => {
        it('should allow checking before starting detection', () => {
            // This is the pattern used to prevent race conditions
            if (!isCVDetectionInProgress()) {
                setCVDetectionInProgress(true);
                // ... do detection ...
                expect(isCVDetectionInProgress()).toBe(true);
                setCVDetectionInProgress(false);
            }
        });
    });
});

describe('Image Loading Configuration', () => {
    describe('IMAGE_LOAD_TIMEOUT_MS', () => {
        it('should be defined', () => {
            expect(IMAGE_LOAD_TIMEOUT_MS).toBeDefined();
        });

        it('should be a positive number', () => {
            expect(IMAGE_LOAD_TIMEOUT_MS).toBeGreaterThan(0);
        });

        it('should be at least 10 seconds', () => {
            expect(IMAGE_LOAD_TIMEOUT_MS).toBeGreaterThanOrEqual(10000);
        });

        it('should be 30 seconds by default', () => {
            expect(IMAGE_LOAD_TIMEOUT_MS).toBe(30000);
        });
    });
});

describe('getDynamicMinConfidence', () => {
    beforeEach(() => {
        setScoringConfig(DEFAULT_SCORING_CONFIG);
    });

    describe('Without Resolution', () => {
        it('should return base threshold for unknown rarity', () => {
            const confidence = getDynamicMinConfidence();
            // Should use baseThreshold + unknown adjustment
            expect(confidence).toBeGreaterThan(0.4);
            expect(confidence).toBeLessThan(0.6);
        });

        it('should adjust for rarity', () => {
            const commonConf = getDynamicMinConfidence(undefined, undefined, 'common');
            const legendaryConf = getDynamicMinConfidence(undefined, undefined, 'legendary');

            expect(commonConf).toBeLessThan(legendaryConf);
        });
    });

    describe('With Resolution', () => {
        it('should lower threshold for low resolution (720p)', () => {
            const lowResConf = getDynamicMinConfidence(1280, 720, 'rare');
            const medResConf = getDynamicMinConfidence(1920, 1080, 'rare');

            expect(lowResConf).toBeLessThan(medResConf);
        });

        it('should maintain baseline for medium resolution (1080p)', () => {
            const conf = getDynamicMinConfidence(1920, 1080, 'rare');
            // 1080p is the baseline, no adjustment
            expect(conf).toBeCloseTo(0.45, 1);
        });

        it('should raise threshold for high resolution (1440p)', () => {
            const highResConf = getDynamicMinConfidence(2560, 1440, 'rare');
            const medResConf = getDynamicMinConfidence(1920, 1080, 'rare');

            expect(highResConf).toBeGreaterThan(medResConf);
        });

        it('should raise threshold more for ultra resolution (4K)', () => {
            const ultraResConf = getDynamicMinConfidence(3840, 2160, 'rare');
            const highResConf = getDynamicMinConfidence(2560, 1440, 'rare');

            expect(ultraResConf).toBeGreaterThan(highResConf);
        });
    });

    describe('Combined Rarity and Resolution', () => {
        it('should combine rarity and resolution adjustments', () => {
            const common720p = getDynamicMinConfidence(1280, 720, 'common');
            const legendary4k = getDynamicMinConfidence(3840, 2160, 'legendary');

            // Common + low res = very lenient
            // Legendary + 4k = strictest
            expect(legendary4k).toBeGreaterThan(common720p);
        });
    });

    describe('Clamping', () => {
        it('should not go below 0.35', () => {
            // Very lenient settings
            const conf = getDynamicMinConfidence(1280, 720, 'common');
            expect(conf).toBeGreaterThanOrEqual(0.35);
        });

        it('should not exceed 0.75', () => {
            // Very strict settings
            const conf = getDynamicMinConfidence(3840, 2160, 'legendary');
            expect(conf).toBeLessThanOrEqual(0.75);
        });
    });

    describe('Edge Cases', () => {
        it('should handle very small resolutions', () => {
            const conf = getDynamicMinConfidence(640, 480, 'rare');
            expect(conf).toBeGreaterThanOrEqual(0.35);
        });

        it('should handle very large resolutions', () => {
            const conf = getDynamicMinConfidence(7680, 4320, 'rare'); // 8K
            expect(conf).toBeLessThanOrEqual(0.75);
        });

        it('should handle non-standard aspect ratios', () => {
            const conf = getDynamicMinConfidence(2560, 1080, 'rare'); // 21:9
            expect(conf).toBeGreaterThanOrEqual(0.35);
            expect(conf).toBeLessThanOrEqual(0.75);
        });

        it('should handle zero dimensions gracefully', () => {
            // Should fall back to base threshold when 0 is passed
            // The function uses width && height check
            const conf = getDynamicMinConfidence(0, 0, 'rare');
            expect(conf).toBeGreaterThanOrEqual(0.35);
        });

        it('should handle undefined rarity with dimensions', () => {
            const conf = getDynamicMinConfidence(1920, 1080, undefined);
            expect(conf).toBeGreaterThanOrEqual(0.35);
            expect(conf).toBeLessThanOrEqual(0.75);
        });
    });
});
