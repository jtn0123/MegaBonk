import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all dependencies before importing
vi.mock('../../src/modules/logger.ts', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../src/modules/image-layout.ts', () => ({
    detectResolution: vi.fn(() => ({ category: 'desktop', width: 1920, height: 1080 })),
}));

vi.mock('../../src/modules/cv/state.ts', () => ({
    getAllData: vi.fn(() => ({ items: { items: [{ id: '1', name: 'Sword' }] } })),
    getItemTemplates: vi.fn(() => new Map()),
    isPriorityTemplatesLoaded: vi.fn(() => true),
}));

vi.mock('../../src/modules/cv/templates.ts', () => ({
    loadItemTemplates: vi.fn(),
}));

vi.mock('../../src/modules/cv/metrics.ts', () => ({
    getMetricsCollector: vi.fn(() => ({
        startRun: vi.fn(),
        endRun: vi.fn(),
        recordGridVerification: vi.fn(),
        recordRarityValidation: vi.fn(),
        recordValidationTime: vi.fn(),
    })),
}));

vi.mock('../../src/modules/cv/ensemble-detector.ts', () => ({
    selectStrategiesForImage: vi.fn(() => ['two_phase']),
}));

vi.mock('../../src/modules/cv/resolution-profiles.ts', () => ({
    getResolutionTier: vi.fn(() => 'desktop'),
}));

vi.mock('../../src/modules/cv/active-learning.ts', () => ({
    findUncertainDetections: vi.fn(() => []),
    shouldPromptForLearning: vi.fn(() => false),
}));

vi.mock('../../src/modules/cv/count-detection.ts', () => ({
    detectCount: vi.fn(() => ({ count: 1, confidence: 0.5 })),
    hasCountOverlay: vi.fn(() => false),
}));

vi.mock('../../src/modules/cv/detection-config.ts', () => ({
    getDynamicMinConfidence: vi.fn(() => 0.6),
    isCVDetectionInProgress: vi.fn(() => false),
    setCVDetectionInProgress: vi.fn(),
}));

vi.mock('../../src/modules/cv/detection-utils.ts', () => ({
    hashImageDataUrl: vi.fn(() => 'hash123'),
}));

vi.mock('../../src/modules/cv/detection-grid.ts', () => ({
    detectHotbarRegion: vi.fn(() => ({ topY: 800, bottomY: 1000, confidence: 0.8 })),
    getAdaptiveIconSizes: vi.fn(() => [32, 48, 64]),
    verifyGridPattern: vi.fn((dets: unknown[]) => ({ isValid: true, filteredDetections: dets })),
    detectGridPositions: vi.fn(() => []),
}));

const mockDetection = {
    entity: { id: '1', name: 'Sword' },
    confidence: 0.85,
    position: { x: 100, y: 800, width: 48, height: 48 },
};

vi.mock('../../src/modules/cv/detection-processing.ts', () => ({
    loadImageToCanvas: vi.fn(() => ({
        ctx: {
            getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4), width: 1920, height: 1080 })),
        },
        width: 1920,
        height: 1080,
    })),
    buildDetectionCacheKey: vi.fn((hash: string, useWorkers: boolean) => `${hash}:${useWorkers ? 'worker' : 'main'}`),
    getCachedResults: vi.fn(() => null),
    cacheResults: vi.fn(),
    boostConfidenceWithContext: vi.fn((dets: unknown[]) => dets),
    validateWithBorderRarity: vi.fn((det: unknown) => det),
}));

vi.mock('../../src/modules/cv/detection-pipeline/two-phase.ts', () => ({
    detectIconsWithTwoPhase: vi.fn(() => ({
        gridUsed: true,
        detections: [mockDetection],
        grid: { columns: 6, rows: 1 },
    })),
}));

vi.mock('../../src/modules/cv/detection-pipeline/sliding-window.ts', () => ({
    detectIconsWithSlidingWindow: vi.fn(() => []),
    detectEquipmentRegion: vi.fn(() => []),
}));

vi.mock('../../src/modules/cv/detection-pipeline/worker-detection.ts', () => ({
    detectItemsWithWorkers: vi.fn(() => []),
}));

describe('orchestrator - detectItemsWithCV', () => {
    let detectItemsWithCV: typeof import('../../src/modules/cv/detection-pipeline/orchestrator.ts').detectItemsWithCV;
    let __resetDetectionStateForTesting: typeof import('../../src/modules/cv/detection-pipeline/orchestrator.ts').__resetDetectionStateForTesting;

    beforeEach(async () => {
        vi.clearAllMocks();
        const mod = await import('../../src/modules/cv/detection-pipeline/orchestrator.ts');
        detectItemsWithCV = mod.detectItemsWithCV;
        __resetDetectionStateForTesting = mod.__resetDetectionStateForTesting;
        __resetDetectionStateForTesting();
    });

    it('should return cached results if available', async () => {
        const { getCachedResults } = await import('../../src/modules/cv/detection-processing.ts');
        vi.mocked(getCachedResults).mockReturnValueOnce([mockDetection]);

        const results = await detectItemsWithCV('data:image/png;base64,abc');
        expect(results).toEqual([mockDetection]);
    });

    it('should return empty array when detection already in progress', async () => {
        const { isCVDetectionInProgress } = await import('../../src/modules/cv/detection-config.ts');
        vi.mocked(isCVDetectionInProgress).mockReturnValueOnce(true);

        const results = await detectItemsWithCV('data:image/png;base64,abc');
        expect(results).toEqual([]);
    });

    it('should load templates if not loaded', async () => {
        const { isPriorityTemplatesLoaded } = await import('../../src/modules/cv/state.ts');
        const { loadItemTemplates } = await import('../../src/modules/cv/templates.ts');
        vi.mocked(isPriorityTemplatesLoaded).mockReturnValueOnce(false);

        await detectItemsWithCV('data:image/png;base64,abc');
        expect(loadItemTemplates).toHaveBeenCalled();
    });

    it('should run two-phase detection and return results', async () => {
        const callback = vi.fn();
        const results = await detectItemsWithCV('data:image/png;base64,abc', callback);

        expect(results.length).toBeGreaterThanOrEqual(0);
        expect(callback).toHaveBeenCalledWith(100, expect.any(String));
    });

    it('should fall back to sliding window when two-phase fails', async () => {
        const { detectIconsWithTwoPhase } = await import('../../src/modules/cv/detection-pipeline/two-phase.ts');
        vi.mocked(detectIconsWithTwoPhase).mockResolvedValueOnce({
            gridUsed: false,
            detections: [],
            grid: null,
        } as any);

        const { detectIconsWithSlidingWindow } = await import('../../src/modules/cv/detection-pipeline/sliding-window.ts');
        vi.mocked(detectIconsWithSlidingWindow).mockResolvedValueOnce([mockDetection]);

        const results = await detectItemsWithCV('data:image/png;base64,abc');
        expect(detectIconsWithSlidingWindow).toHaveBeenCalled();
    });

    it('should use worker path when useWorkers is true', async () => {
        const { detectItemsWithWorkers } = await import('../../src/modules/cv/detection-pipeline/worker-detection.ts');
        vi.mocked(detectItemsWithWorkers).mockResolvedValueOnce([mockDetection]);
        const originalWorker = globalThis.Worker;
        (globalThis as typeof globalThis & { Worker: typeof Worker }).Worker = vi.fn() as unknown as typeof Worker;

        try {
            await detectItemsWithCV('data:image/png;base64,abc', undefined, true);
            expect(detectItemsWithWorkers).toHaveBeenCalled();
        } finally {
            if (originalWorker) {
                (globalThis as typeof globalThis & { Worker: typeof Worker }).Worker = originalWorker;
            } else {
                delete (globalThis as typeof globalThis & { Worker?: typeof Worker }).Worker;
            }
        }
    });

    it('should route worker detections through shared post-processing', async () => {
        const { detectItemsWithWorkers } = await import('../../src/modules/cv/detection-pipeline/worker-detection.ts');
        const { boostConfidenceWithContext, cacheResults } = await import('../../src/modules/cv/detection-processing.ts');
        vi.mocked(detectItemsWithWorkers).mockResolvedValueOnce([mockDetection]);
        const originalWorker = globalThis.Worker;
        (globalThis as typeof globalThis & { Worker: typeof Worker }).Worker = vi.fn() as unknown as typeof Worker;

        try {
            await detectItemsWithCV('data:image/png;base64,abc', undefined, true);
            expect(boostConfidenceWithContext).toHaveBeenCalled();
            expect(cacheResults).toHaveBeenCalled();
        } finally {
            if (originalWorker) {
                (globalThis as typeof globalThis & { Worker: typeof Worker }).Worker = originalWorker;
            } else {
                delete (globalThis as typeof globalThis & { Worker?: typeof Worker }).Worker;
            }
        }
    });

    it('should handle detection errors', async () => {
        const { loadImageToCanvas } = await import('../../src/modules/cv/detection-processing.ts');
        vi.mocked(loadImageToCanvas).mockRejectedValueOnce(new Error('Canvas failed'));

        await expect(detectItemsWithCV('data:image/png;base64,abc')).rejects.toThrow('Canvas failed');
    });

    it('should reset detection in progress on error', async () => {
        const { loadImageToCanvas } = await import('../../src/modules/cv/detection-processing.ts');
        const { setCVDetectionInProgress } = await import('../../src/modules/cv/detection-config.ts');
        vi.mocked(loadImageToCanvas).mockRejectedValueOnce(new Error('fail'));

        try { await detectItemsWithCV('data:image/png;base64,abc'); } catch { /* expected */ }
        expect(setCVDetectionInProgress).toHaveBeenCalledWith(false);
    });

    it('should call progress callback at various stages', async () => {
        const callback = vi.fn();
        await detectItemsWithCV('data:image/png;base64,abc', callback);

        // Should have been called with various progress values
        const progressValues = callback.mock.calls.map(c => c[0]);
        expect(progressValues).toContain(0);
        expect(progressValues).toContain(100);
    });

    it('should cache results after detection', async () => {
        const { cacheResults } = await import('../../src/modules/cv/detection-processing.ts');
        await detectItemsWithCV('data:image/png;base64,abc');
        expect(cacheResults).toHaveBeenCalled();
    });

    it('should annotate stack counts', async () => {
        const { hasCountOverlay, detectCount } = await import('../../src/modules/cv/count-detection.ts');
        vi.mocked(hasCountOverlay).mockReturnValue(true);
        vi.mocked(detectCount).mockReturnValue({ count: 3, confidence: 0.9 } as any);

        const results = await detectItemsWithCV('data:image/png;base64,abc');
        expect(hasCountOverlay).toHaveBeenCalled();
    });

    it('should log active learning when uncertain detections found', async () => {
        const { findUncertainDetections, shouldPromptForLearning } = await import('../../src/modules/cv/active-learning.ts');
        vi.mocked(findUncertainDetections).mockReturnValueOnce([
            { detection: { detectedItemName: 'Sword', confidence: 0.55, detectedItemId: '1', x: 0, y: 0, width: 48, height: 48 }, alternatives: [] },
        ]);
        vi.mocked(shouldPromptForLearning).mockReturnValueOnce(true);

        const { logger } = await import('../../src/modules/logger.ts');
        await detectItemsWithCV('data:image/png;base64,abc');
        expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({
            operation: 'cv.active_learning.uncertain_found',
        }));
    });
});
